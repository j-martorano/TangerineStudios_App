"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/permissions";
import { TAB_KEYS, type TabKey } from "@/lib/auth/tabs";
import { createBotClient } from "@/lib/supabase/bot";
import { generatePassword } from "@/lib/vault/password";

/**
 * Administración de usuarios. Todo pasa por `assertAdmin()`: aunque alguien
 * llame a estas acciones a mano, si no es admin no hacen nada. Las escrituras
 * van con service role porque la tabla profiles no deja escribir a nadie con
 * su propia sesión (así nadie puede darse permisos a sí mismo).
 */

export type UserResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const uuid = z.string().uuid("ID inválido");

const tabsSchema = z
  .array(z.string())
  .transform((arr) => arr.filter((t): t is TabKey => (TAB_KEYS as readonly string[]).includes(t)));

const permissionsSchema = z.object({
  displayName: z.string().trim().max(80).nullable(),
  role: z.enum(["admin", "member"]),
  tabs: tabsSchema,
  credentialIds: z.array(uuid).default([]),
});

export type PermissionsInput = z.input<typeof permissionsSchema>;

const createSchema = permissionsSchema.extend({
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export type CreateUserInput = z.input<typeof createSchema>;

/** Una credencial que la persona conocía (para sugerir rotarla). */
export type KnownCredential = { id: string; name: string };

const BAN_FOREVER = "876000h"; // ~100 años

function revalidateUsers() {
  revalidatePath("/usuarios");
  revalidatePath("/boveda");
  revalidatePath("/", "layout");
}

async function logVault(
  event: "access_granted" | "access_revoked",
  credentialId: string,
  actorId: string,
  targetUserId: string
) {
  await createBotClient().from("vault_events").insert({
    event,
    credential_id: credentialId,
    actor_id: actorId,
    target_user_id: targetUserId,
  });
}

/** Reemplaza las credenciales visibles de un usuario. */
async function syncUserCredentials(userId: string, credentialIds: string[], actorId: string) {
  const sb = createBotClient();
  const { data: current } = await sb
    .from("vault_access")
    .select("credential_id")
    .eq("user_id", userId);
  const before = new Set((current ?? []).map((a) => a.credential_id));
  const after = new Set(credentialIds);
  const toAdd = [...after].filter((id) => !before.has(id));
  const toRemove = [...before].filter((id) => !after.has(id));

  if (toAdd.length > 0) {
    await sb
      .from("vault_access")
      .insert(toAdd.map((credential_id) => ({ credential_id, user_id: userId })));
  }
  if (toRemove.length > 0) {
    await sb
      .from("vault_access")
      .delete()
      .eq("user_id", userId)
      .in("credential_id", toRemove);
  }
  for (const id of toAdd) await logVault("access_granted", id, actorId, userId);
  for (const id of toRemove) await logVault("access_revoked", id, actorId, userId);
}

/** Saca todas las credenciales de un usuario y devuelve cuáles tenía. */
async function revokeAllCredentials(userId: string, actorId: string): Promise<KnownCredential[]> {
  const sb = createBotClient();
  const { data: access } = await sb
    .from("vault_access")
    .select("credential_id, vault_credentials(name)")
    .eq("user_id", userId);
  const known: KnownCredential[] = (access ?? []).map((a) => ({
    id: a.credential_id,
    name:
      (a.vault_credentials as unknown as { name: string } | null)?.name ?? "Credencial",
  }));
  if (known.length > 0) {
    await sb.from("vault_access").delete().eq("user_id", userId);
    for (const c of known) await logVault("access_revoked", c.id, actorId, userId);
  }
  return known;
}

async function countActiveAdmins(): Promise<number> {
  const { count } = await createBotClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("disabled", false);
  return count ?? 0;
}

// ---------------------------------------------------------------------------

/**
 * Crea la cuenta con una contraseña temporal generada. La contraseña se
 * devuelve UNA vez para que Joaco se la pase a la persona; no queda guardada.
 */
export async function createUser(
  input: CreateUserInput
): Promise<UserResult<{ tempPassword: string }>> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  const sb = createBotClient();
  const tempPassword = generatePassword(16);
  const { data: created, error } = await sb.auth.admin.createUser({
    email: d.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: d.displayName ? { display_name: d.displayName } : undefined,
  });
  if (error || !created.user) {
    const msg = error?.message ?? "No se pudo crear el usuario";
    if (msg.toLowerCase().includes("already")) {
      return { ok: false, error: "Ya existe un usuario con ese email" };
    }
    return { ok: false, error: msg };
  }

  // El trigger handle_new_user ya creó el perfil vacío; upsert por si acaso.
  const { error: profileError } = await sb.from("profiles").upsert({
    id: created.user.id,
    email: d.email,
    display_name: d.displayName || null,
    role: d.role,
    allowed_tabs: d.tabs,
    updated_at: new Date().toISOString(),
  });
  if (profileError) return { ok: false, error: profileError.message };

  await syncUserCredentials(created.user.id, d.credentialIds, guard.viewer.id);
  revalidateUsers();
  return { ok: true, data: { tempPassword } };
}

/** Cambia nombre, rol, pestañas y credenciales visibles de un usuario. */
export async function updateUserPermissions(
  userId: string,
  input: PermissionsInput
): Promise<UserResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(userId).success) return { ok: false, error: "ID inválido" };
  const parsed = permissionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  const sb = createBotClient();
  const { data: target } = await sb
    .from("profiles")
    .select("role, disabled")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "El usuario no existe" };

  if (target.role === "admin" && d.role !== "admin") {
    if (userId === guard.viewer.id) {
      return { ok: false, error: "No podés sacarte el rol de admin a vos mismo" };
    }
    if (!target.disabled && (await countActiveAdmins()) <= 1) {
      return { ok: false, error: "Tiene que quedar al menos un admin" };
    }
  }

  const { error } = await sb
    .from("profiles")
    .update({
      display_name: d.displayName || null,
      role: d.role,
      allowed_tabs: d.tabs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await syncUserCredentials(userId, d.credentialIds, guard.viewer.id);
  revalidateUsers();
  return { ok: true };
}

/**
 * Saca a una persona: bloquea la cuenta (no puede volver a entrar), le quita
 * todas las credenciales de la Bóveda y devuelve cuáles conocía, para que la
 * pantalla le proponga a Joaco rotarlas.
 */
export async function disableUser(
  userId: string
): Promise<UserResult<{ knownCredentials: KnownCredential[] }>> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(userId).success) return { ok: false, error: "ID inválido" };
  if (userId === guard.viewer.id) return { ok: false, error: "No podés deshabilitarte a vos mismo" };

  const sb = createBotClient();
  const { data: target } = await sb.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return { ok: false, error: "El usuario no existe" };
  if (target.role === "admin" && (await countActiveAdmins()) <= 1) {
    return { ok: false, error: "Tiene que quedar al menos un admin" };
  }

  const { error: banError } = await sb.auth.admin.updateUserById(userId, {
    ban_duration: BAN_FOREVER,
  });
  if (banError) return { ok: false, error: banError.message };

  await sb
    .from("profiles")
    .update({ disabled: true, updated_at: new Date().toISOString() })
    .eq("id", userId);

  const knownCredentials = await revokeAllCredentials(userId, guard.viewer.id);
  revalidateUsers();
  return { ok: true, data: { knownCredentials } };
}

/** Vuelve a habilitar una cuenta (sin credenciales: se dan de nuevo a mano). */
export async function enableUser(userId: string): Promise<UserResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(userId).success) return { ok: false, error: "ID inválido" };

  const sb = createBotClient();
  const { error: banError } = await sb.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (banError) return { ok: false, error: banError.message };
  await sb
    .from("profiles")
    .update({ disabled: false, updated_at: new Date().toISOString() })
    .eq("id", userId);
  revalidateUsers();
  return { ok: true };
}

/** Genera una contraseña temporal nueva para el usuario y la devuelve una vez. */
export async function resetUserPassword(
  userId: string
): Promise<UserResult<{ tempPassword: string }>> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(userId).success) return { ok: false, error: "ID inválido" };

  const tempPassword = generatePassword(16);
  const { error } = await createBotClient().auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { tempPassword } };
}

/** Borra la cuenta. Devuelve las credenciales que conocía para rotarlas. */
export async function deleteUser(
  userId: string
): Promise<UserResult<{ knownCredentials: KnownCredential[] }>> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(userId).success) return { ok: false, error: "ID inválido" };
  if (userId === guard.viewer.id) return { ok: false, error: "No podés borrarte a vos mismo" };

  const sb = createBotClient();
  const { data: target } = await sb.from("profiles").select("role, disabled").eq("id", userId).maybeSingle();
  if (target?.role === "admin" && !target.disabled && (await countActiveAdmins()) <= 1) {
    return { ok: false, error: "Tiene que quedar al menos un admin" };
  }

  const knownCredentials = await revokeAllCredentials(userId, guard.viewer.id);
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };
  revalidateUsers();
  return { ok: true, data: { knownCredentials } };
}
