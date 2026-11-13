"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin, assertTab } from "@/lib/auth/permissions";
import { createBotClient } from "@/lib/supabase/bot";
import { decryptSecret, encryptSecret } from "./crypto";
import { CREDENTIAL_KINDS } from "./presets";

export type VaultResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const uuid = z.string().uuid("ID inválido");

function revalidateVault() {
  revalidatePath("/boveda");
  revalidatePath("/usuarios");
  // El badge del sidebar vive en el layout.
  revalidatePath("/", "layout");
}

async function logEvent(
  event: "created" | "updated" | "rotated" | "viewed" | "access_granted" | "access_revoked",
  credentialId: string,
  actorId: string,
  targetUserId: string | null = null
) {
  await createBotClient().from("vault_events").insert({
    event,
    credential_id: credentialId,
    actor_id: actorId,
    target_user_id: targetUserId,
  });
}

// ---------------------------------------------------------------------------
// Para cualquier usuario con la Bóveda habilitada
// ---------------------------------------------------------------------------

/**
 * Devuelve la contraseña en texto plano si el usuario la tiene habilitada
 * (o es admin). Cada vez que alguien la ve queda registrado.
 */
export async function revealSecret(
  credentialId: string
): Promise<VaultResult<{ secret: string }>> {
  const guard = await assertTab("boveda");
  if (!guard.ok) return guard;
  if (!uuid.safeParse(credentialId).success) return { ok: false, error: "ID inválido" };

  const sb = createBotClient();
  if (guard.viewer.role !== "admin") {
    const { data: access } = await sb
      .from("vault_access")
      .select("credential_id")
      .eq("credential_id", credentialId)
      .eq("user_id", guard.viewer.id)
      .maybeSingle();
    if (!access) return { ok: false, error: "No tenés acceso a esta credencial" };
  }

  const { data: cred } = await sb
    .from("vault_credentials")
    .select("secret_ciphertext")
    .eq("id", credentialId)
    .maybeSingle();
  if (!cred) return { ok: false, error: "La credencial no existe" };

  let secret: string;
  try {
    secret = decryptSecret(cred.secret_ciphertext);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo descifrar" };
  }

  await logEvent("viewed", credentialId, guard.viewer.id);
  return { ok: true, data: { secret } };
}

/** Marca como leídos los avisos del usuario logueado. */
export async function markVaultNotificationsRead(): Promise<VaultResult> {
  const guard = await assertTab("boveda");
  if (!guard.ok) return guard;
  await createBotClient()
    .from("vault_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", guard.viewer.id)
    .is("read_at", null);
  revalidateVault();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Solo admin
// ---------------------------------------------------------------------------

const optionalUrl = z
  .string()
  .trim()
  .url("Link inválido")
  .nullable()
  .or(z.literal("").transform(() => null));

const metadataSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(80),
  kind: z.enum(CREDENTIAL_KINDS),
  username: z.string().trim().max(200).nullable(),
  loginUrl: optionalUrl,
  changePasswordUrl: optionalUrl,
  notes: z.string().trim().max(1000).nullable(),
  userIds: z.array(uuid).default([]),
});

export type CredentialInput = z.input<typeof metadataSchema>;

const createSchema = metadataSchema.extend({
  password: z.string().min(1, "Falta la contraseña").max(500),
});

/** Sincroniza quién ve una credencial y registra altas/bajas. */
async function syncAccess(credentialId: string, userIds: string[], actorId: string) {
  const sb = createBotClient();
  const { data: current } = await sb
    .from("vault_access")
    .select("user_id")
    .eq("credential_id", credentialId);
  const before = new Set((current ?? []).map((a) => a.user_id));
  const after = new Set(userIds);

  const toAdd = [...after].filter((id) => !before.has(id));
  const toRemove = [...before].filter((id) => !after.has(id));

  if (toAdd.length > 0) {
    await sb
      .from("vault_access")
      .insert(toAdd.map((user_id) => ({ credential_id: credentialId, user_id })));
  }
  if (toRemove.length > 0) {
    await sb
      .from("vault_access")
      .delete()
      .eq("credential_id", credentialId)
      .in("user_id", toRemove);
  }
  for (const id of toAdd) await logEvent("access_granted", credentialId, actorId, id);
  for (const id of toRemove) await logEvent("access_revoked", credentialId, actorId, id);
}

export async function createCredential(input: CredentialInput & { password: string }): Promise<VaultResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  let ciphertext: string;
  try {
    ciphertext = encryptSecret(d.password);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cifrar" };
  }

  const { data: created, error } = await createBotClient()
    .from("vault_credentials")
    .insert({
      name: d.name,
      kind: d.kind,
      username: d.username || null,
      login_url: d.loginUrl,
      change_password_url: d.changePasswordUrl,
      notes: d.notes || null,
      secret_ciphertext: ciphertext,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? "No se pudo crear" };

  await logEvent("created", created.id, guard.viewer.id);
  await syncAccess(created.id, d.userIds, guard.viewer.id);
  revalidateVault();
  return { ok: true };
}

/** Edita los datos de una credencial y quién la ve. No toca la contraseña. */
export async function updateCredential(id: string, input: CredentialInput): Promise<VaultResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  const parsed = metadataSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  const { error } = await createBotClient()
    .from("vault_credentials")
    .update({
      name: d.name,
      kind: d.kind,
      username: d.username || null,
      login_url: d.loginUrl,
      change_password_url: d.changePasswordUrl,
      notes: d.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logEvent("updated", id, guard.viewer.id);
  await syncAccess(id, d.userIds, guard.viewer.id);
  revalidateVault();
  return { ok: true };
}

export async function deleteCredential(id: string): Promise<VaultResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  const { error } = await createBotClient().from("vault_credentials").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateVault();
  return { ok: true };
}

/**
 * Guarda la contraseña nueva después de que Joaco la cambió en el servicio.
 * Sube `version`, y el trigger `vault_notify_rotation` de la base crea un
 * aviso solo para quienes tienen acceso a esta credencial.
 * Devuelve los nombres de las personas avisadas.
 */
export async function rotateCredential(
  id: string,
  newPassword: string
): Promise<VaultResult<{ notified: string[] }>> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "La contraseña nueva tiene que tener al menos 8 caracteres" };
  }

  const sb = createBotClient();
  const { data: cred } = await sb
    .from("vault_credentials")
    .select("version")
    .eq("id", id)
    .maybeSingle();
  if (!cred) return { ok: false, error: "La credencial no existe" };

  let ciphertext: string;
  try {
    ciphertext = encryptSecret(newPassword);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cifrar" };
  }

  // Quiénes van a recibir el aviso: la misma regla que el trigger
  // vault_notify_rotation (acceso a esta credencial y usuario habilitado).
  const { data: access } = await sb
    .from("vault_access")
    .select("user_id")
    .eq("credential_id", id);
  const accessIds = (access ?? []).map((a) => a.user_id);
  let notified: string[] = [];
  if (accessIds.length > 0) {
    const { data: people } = await sb
      .from("profiles")
      .select("email, display_name")
      .in("id", accessIds)
      .eq("disabled", false);
    notified = (people ?? []).map((p) => p.display_name || p.email);
  }

  const now = new Date().toISOString();
  const { error } = await sb
    .from("vault_credentials")
    .update({
      secret_ciphertext: ciphertext,
      version: cred.version + 1,
      rotated_at: now,
      updated_at: now,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logEvent("rotated", id, guard.viewer.id);

  revalidateVault();
  return { ok: true, data: { notified } };
}
