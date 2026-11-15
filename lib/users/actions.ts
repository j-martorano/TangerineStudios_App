"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/permissions";
import { TAB_KEYS, type TabKey } from "@/lib/auth/tabs";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createBotClient } from "@/lib/supabase/bot";
import {
  knownCredentialsFor,
  logVaultEvents,
  syncVaultAccess,
  type KnownCredential,
} from "@/lib/vault/events";
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

// Ojo: no re-exportar tipos acá ("export type { X }"): en un archivo
// "use server" Next lo trata como un valor y el módulo no carga. El tipo
// KnownCredential se importa desde lib/vault/events.ts.

// Formato 8-4-4-4-12 sin exigir versión RFC: los ids del seed y de datos
// importados a mano (p. ej. editores) no siempre son UUID v4.
const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID inválido");

const tabsSchema = z
  .array(z.string())
  .transform((arr) => arr.filter((t): t is TabKey => (TAB_KEYS as readonly string[]).includes(t)));

const permissionsSchema = z.object({
  displayName: z.string().trim().max(80).nullable(),
  role: z.enum(["admin", "member"]),
  tabs: tabsSchema,
  credentialIds: z.array(uuid).default([]),
  /**
   * Ficha de /editors de esta cuenta. `null` desvincula; si no viene, no se
   * toca (las acciones rápidas de la fila no lo mandan).
   */
  editorId: uuid.nullable().optional(),
});

export type PermissionsInput = z.input<typeof permissionsSchema>;

const createSchema = permissionsSchema.extend({
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export type CreateUserInput = z.input<typeof createSchema>;

const BAN_FOREVER = "876000h"; // ~100 años

function revalidateUsers() {
  revalidatePath("/usuarios");
  revalidatePath("/boveda");
  revalidatePath("/", "layout");
}

/** Nombre de cada credencial, para el historial. */
async function credentialNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await createBotClient().from("vault_credentials").select("id, name").in("id", ids);
  return new Map((data ?? []).map((c) => [c.id, c.name]));
}

/** Reemplaza las credenciales visibles de un usuario y lo deja registrado. */
async function syncUserCredentials(
  userId: string,
  credentialIds: string[],
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await syncVaultAccess({ userId }, credentialIds);
  if (!res.ok) return res;
  const { added, removed } = res.change;
  const names = await credentialNames([...added, ...removed]);
  await logVaultEvents([
    ...added.map((id) => ({
      event: "access_granted" as const,
      credentialId: id,
      credentialName: names.get(id) ?? null,
      actorId,
      targetUserId: userId,
    })),
    ...removed.map((id) => ({
      event: "access_revoked" as const,
      credentialId: id,
      credentialName: names.get(id) ?? null,
      actorId,
      targetUserId: userId,
    })),
  ]);
  return { ok: true };
}

/** La lista de editores se cachea: cualquier cambio de vínculo la invalida. */
function revalidateEditors() {
  revalidateTag(CACHE_TAGS.editors, {});
  revalidatePath("/editors");
}

/**
 * Vincula la cuenta con su ficha de editor, o la desvincula con `null`. Un
 * editor tiene una sola cuenta y una cuenta un solo editor: si el editor ya es
 * de otra persona, error; si la cuenta tenía otro editor, se suelta.
 */
async function linkEditor(
  userId: string,
  editorId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createBotClient();
  if (editorId) {
    const { data: editor } = await sb
      .from("editors")
      .select("id, name, user_id")
      .eq("id", editorId)
      .maybeSingle();
    if (!editor) return { ok: false, error: "Ese editor no existe" };
    if (editor.user_id && editor.user_id !== userId) {
      return { ok: false, error: `${editor.name} ya tiene su propia cuenta` };
    }
  }
  const clear = sb.from("editors").update({ user_id: null }).eq("user_id", userId);
  const { error: clearError } = await (editorId ? clear.neq("id", editorId) : clear);
  if (clearError) return { ok: false, error: clearError.message };
  if (editorId) {
    const { error } = await sb.from("editors").update({ user_id: userId }).eq("id", editorId);
    if (error) return { ok: false, error: error.message };
  }
  revalidateEditors();
  return { ok: true };
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
): Promise<UserResult<{ tempPassword: string; warning: string | null }>> {
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
  if (profileError) {
    // Sin perfil la cuenta no sirve; se borra para poder reintentar.
    await sb.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: `No se pudo crear el usuario: ${profileError.message}` };
  }

  const warnings: string[] = [];
  if (d.editorId) {
    const link = await linkEditor(created.user.id, d.editorId);
    if (!link.ok) warnings.push(`No se pudo vincular con el editor (${link.error}). Hacelo desde «Permisos».`);
  }
  const access = await syncUserCredentials(created.user.id, d.credentialIds, guard.viewer.id);
  if (!access.ok) {
    warnings.push(`No se pudieron asignar las credenciales (${access.error}). Asignalas desde «Permisos».`);
  }
  revalidateUsers();
  return {
    ok: true,
    data: { tempPassword, warning: warnings.length > 0 ? warnings.join(" ") : null },
  };
}

/**
 * Cambia nombre, rol, pestañas y credenciales visibles de un usuario.
 * Devuelve las credenciales que conocía y ya no puede ver (le sacaste el
 * acceso, la pestaña Bóveda o el rol de admin), para proponer rotarlas.
 */
export async function updateUserPermissions(
  userId: string,
  input: PermissionsInput
): Promise<UserResult<{ lostCredentials: KnownCredential[] }>> {
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

  // Lo que conocía antes del cambio.
  const knownBefore = await knownCredentialsFor(userId);

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

  const access = await syncUserCredentials(userId, d.credentialIds, guard.viewer.id);
  revalidateUsers();
  if (!access.ok) {
    return { ok: false, error: `Las pestañas se guardaron, pero no las credenciales: ${access.error}` };
  }
  if (d.editorId !== undefined) {
    const link = await linkEditor(userId, d.editorId);
    if (!link.ok) {
      return { ok: false, error: `Los permisos se guardaron, pero no el vínculo con el editor: ${link.error}` };
    }
  }

  // Lo que puede ver después: admin ve todo; si no, solo con la pestaña Bóveda
  // y las credenciales tildadas.
  const canSee = (id: string) =>
    d.role === "admin" || (d.tabs.includes("boveda") && d.credentialIds.includes(id));
  const lostCredentials = target.disabled ? [] : knownBefore.filter((c) => !canSee(c.id));
  return { ok: true, data: { lostCredentials } };
}

/** Saca todas las credenciales de un usuario y lo deja registrado. */
async function revokeAllAccess(userId: string, actorId: string): Promise<void> {
  const res = await syncVaultAccess({ userId }, []);
  if (!res.ok || res.change.removed.length === 0) return;
  const names = await credentialNames(res.change.removed);
  await logVaultEvents(
    res.change.removed.map((id) => ({
      event: "access_revoked" as const,
      credentialId: id,
      credentialName: names.get(id) ?? null,
      actorId,
      targetUserId: userId,
    }))
  );
}

/**
 * Saca a una persona: la app la deja afuera desde el próximo click, se le
 * bloquea el login, pierde todas las credenciales de la Bóveda, y se devuelve
 * lo que conocía (lo que tenía habilitado y lo que vio alguna vez) para que la
 * pantalla le proponga a Joaco rotarlo.
 */
export async function disableUser(
  userId: string,
  opts: { disableEditor?: boolean } = {}
): Promise<UserResult<{ knownCredentials: KnownCredential[]; warning: string | null }>> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(userId).success) return { ok: false, error: "ID inválido" };
  if (userId === guard.viewer.id) return { ok: false, error: "No podés deshabilitarte a vos mismo" };

  const sb = createBotClient();
  const { data: target } = await sb
    .from("profiles")
    .select("role, disabled")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "El usuario no existe" };
  if (target.role === "admin" && !target.disabled && (await countActiveAdmins()) <= 1) {
    return { ok: false, error: "Tiene que quedar al menos un admin" };
  }

  const knownCredentials = await knownCredentialsFor(userId);

  // Primero el flag: es lo que corta el acceso en la app y en la base al
  // instante (la sesión que ya tiene abierta sigue siendo válida para
  // Supabase hasta que vence, pero getViewer y has_any_tab la rechazan).
  const { error: profileError } = await sb
    .from("profiles")
    .update({ disabled: true, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (profileError) return { ok: false, error: profileError.message };

  // Después el bloqueo del login, para que no pueda renovar la sesión.
  const { error: banError } = await sb.auth.admin.updateUserById(userId, {
    ban_duration: BAN_FOREVER,
  });

  await revokeAllAccess(userId, guard.viewer.id);

  // Si es un editor, opcionalmente su ficha también deja de ofrecerse en las
  // listas (igual que «Deshabilitar» en /editors). Sus proyectos no se tocan.
  let editorWarning: string | null = null;
  if (opts.disableEditor === true) {
    const { error } = await sb
      .from("editors")
      .update({ disabled_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("disabled_at", null);
    if (error) editorWarning = `No se pudo deshabilitar su ficha de editor (${error.message}).`;
    revalidateEditors();
  }

  revalidateUsers();
  const warnings = [
    banError
      ? `Ya no puede usar la app, pero no se pudo bloquear su login (${banError.message}). Probá «Sacar» de nuevo.`
      : null,
    editorWarning,
  ].filter((w): w is string => w != null);
  return {
    ok: true,
    data: { knownCredentials, warning: warnings.length > 0 ? warnings.join(" ") : null },
  };
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
  const { error } = await sb
    .from("profiles")
    .update({ disabled: false, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
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
): Promise<UserResult<{ knownCredentials: KnownCredential[]; warning: string | null }>> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(userId).success) return { ok: false, error: "ID inválido" };
  if (userId === guard.viewer.id) return { ok: false, error: "No podés borrarte a vos mismo" };

  const sb = createBotClient();
  const { data: target } = await sb.from("profiles").select("role, disabled").eq("id", userId).maybeSingle();
  if (target?.role === "admin" && !target.disabled && (await countActiveAdmins()) <= 1) {
    return { ok: false, error: "Tiene que quedar al menos un admin" };
  }

  // Antes de borrar: lo que conocía, y el registro de bajas (con su email,
  // que queda en el historial aunque la cuenta ya no exista).
  const knownCredentials = await knownCredentialsFor(userId);
  await revokeAllAccess(userId, guard.viewer.id);

  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) {
    revalidateUsers();
    return { ok: false, error: `Se le sacaron las credenciales, pero no se pudo borrar la cuenta: ${error.message}` };
  }
  revalidateUsers();
  return { ok: true, data: { knownCredentials, warning: null } };
}
