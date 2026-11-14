"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin, assertTab } from "@/lib/auth/permissions";
import { createBotClient } from "@/lib/supabase/bot";
import { decryptSecret, encryptSecret } from "./crypto";
import { logVaultEvents, syncVaultAccess } from "./events";
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
    .select("name, secret_ciphertext")
    .eq("id", credentialId)
    .maybeSingle();
  if (!cred) return { ok: false, error: "La credencial no existe" };

  let secret: string;
  try {
    secret = decryptSecret(cred.secret_ciphertext, credentialId);
  } catch {
    return { ok: false, error: "No se pudo descifrar la contraseña" };
  }

  await logVaultEvents([
    { event: "viewed", credentialId, credentialName: cred.name, actorId: guard.viewer.id },
  ]);
  return { ok: true, data: { secret } };
}

/** Marca como leídos los avisos del usuario logueado. */
export async function markVaultNotificationsRead(): Promise<VaultResult> {
  const guard = await assertTab("boveda");
  if (!guard.ok) return guard;
  const { error } = await createBotClient()
    .from("vault_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", guard.viewer.id)
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
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

const passwordSchema = z
  .string()
  .min(1, "Falta la contraseña")
  .max(500, "La contraseña es demasiado larga");

const createSchema = metadataSchema.extend({ password: passwordSchema });

/** Sincroniza quién ve una credencial y registra altas y bajas. */
async function syncAccess(
  credentialId: string,
  credentialName: string,
  userIds: string[],
  actorId: string
): Promise<{ ok: true; removed: string[] } | { ok: false; error: string }> {
  const res = await syncVaultAccess({ credentialId }, userIds);
  if (!res.ok) return res;
  await logVaultEvents([
    ...res.change.added.map((id) => ({
      event: "access_granted" as const,
      credentialId,
      credentialName,
      actorId,
      targetUserId: id,
    })),
    ...res.change.removed.map((id) => ({
      event: "access_revoked" as const,
      credentialId,
      credentialName,
      actorId,
      targetUserId: id,
    })),
  ]);
  return { ok: true, removed: res.change.removed };
}

export async function createCredential(
  input: CredentialInput & { password: string }
): Promise<VaultResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  // El id se genera acá porque el cifrado lo usa (ver lib/vault/crypto.ts).
  const id = randomUUID();
  let ciphertext: string;
  try {
    ciphertext = encryptSecret(d.password, id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cifrar" };
  }

  const { error } = await createBotClient().from("vault_credentials").insert({
    id,
    name: d.name,
    kind: d.kind,
    username: d.username || null,
    login_url: d.loginUrl,
    change_password_url: d.changePasswordUrl,
    notes: d.notes || null,
    secret_ciphertext: ciphertext,
  });
  if (error) return { ok: false, error: error.message };

  await logVaultEvents([
    { event: "created", credentialId: id, credentialName: d.name, actorId: guard.viewer.id },
  ]);
  const access = await syncAccess(id, d.name, d.userIds, guard.viewer.id);
  revalidateVault();
  if (!access.ok) {
    return { ok: false, error: `La credencial se creó, pero no se pudo guardar quién la ve: ${access.error}` };
  }
  return { ok: true };
}

/**
 * Edita los datos de una credencial y quién la ve. No toca la contraseña.
 * Devuelve los nombres de quienes perdieron el acceso: ya la conocían, así
 * que la pantalla propone rotarla.
 */
export async function updateCredential(
  id: string,
  input: CredentialInput
): Promise<VaultResult<{ revokedNames: string[] }>> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  const parsed = metadataSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  const sb = createBotClient();
  const { error } = await sb
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

  await logVaultEvents([
    { event: "updated", credentialId: id, credentialName: d.name, actorId: guard.viewer.id },
  ]);
  const access = await syncAccess(id, d.name, d.userIds, guard.viewer.id);
  revalidateVault();
  if (!access.ok) {
    return { ok: false, error: `Los datos se guardaron, pero no quién la ve: ${access.error}` };
  }

  let revokedNames: string[] = [];
  if (access.removed.length > 0) {
    const { data: people } = await sb
      .from("profiles")
      .select("email, display_name")
      .in("id", access.removed);
    revokedNames = (people ?? []).map((p) => p.display_name || p.email);
  }
  return { ok: true, data: { revokedNames } };
}

export async function deleteCredential(id: string): Promise<VaultResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };

  const sb = createBotClient();
  const { data: cred } = await sb.from("vault_credentials").select("name").eq("id", id).maybeSingle();
  if (!cred) return { ok: false, error: "La credencial no existe" };

  const { error } = await sb.from("vault_credentials").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  // El historial queda (credential_id pasa a null y se conserva el nombre).
  await logVaultEvents([
    { event: "deleted", credentialId: null, credentialName: cred.name, actorId: guard.viewer.id },
  ]);
  revalidateVault();
  return { ok: true };
}

/**
 * Guarda la contraseña nueva después de que Joaco la cambió en el servicio.
 * Sube `version`, y el trigger `vault_notify_rotation` de la base crea un
 * aviso para quienes tienen acceso a esta credencial y pueden abrir la Bóveda.
 * Devuelve los nombres de las personas avisadas.
 */
export async function rotateCredential(
  id: string,
  newPassword: string
): Promise<VaultResult<{ notified: string[] }>> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  const pw = passwordSchema.safeParse(newPassword);
  if (!pw.success) return { ok: false, error: pw.error.issues[0]?.message ?? "Contraseña inválida" };
  if (newPassword.length < 8) {
    return { ok: false, error: "La contraseña nueva tiene que tener al menos 8 caracteres" };
  }

  const sb = createBotClient();
  const { data: cred } = await sb
    .from("vault_credentials")
    .select("name, version")
    .eq("id", id)
    .maybeSingle();
  if (!cred) return { ok: false, error: "La credencial no existe" };

  let ciphertext: string;
  try {
    ciphertext = encryptSecret(newPassword, id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cifrar" };
  }

  // Quiénes van a recibir el aviso: la misma regla que el trigger
  // vault_notify_rotation (acceso a esta credencial, habilitado, y admin o
  // con la pestaña Bóveda).
  const { data: access } = await sb
    .from("vault_access")
    .select("user_id")
    .eq("credential_id", id);
  const accessIds = (access ?? []).map((a) => a.user_id);
  let notified: string[] = [];
  if (accessIds.length > 0) {
    const { data: people } = await sb
      .from("profiles")
      .select("email, display_name, role, allowed_tabs")
      .in("id", accessIds)
      .eq("disabled", false);
    notified = (people ?? [])
      .filter((p) => p.role === "admin" || (p.allowed_tabs ?? []).includes("boveda"))
      .map((p) => p.display_name || p.email);
  }

  // `.eq("version", ...)`: si otro admin rotó al mismo tiempo, no pisar su
  // contraseña sin avisar.
  const now = new Date().toISOString();
  const { data: updated, error } = await sb
    .from("vault_credentials")
    .update({
      secret_ciphertext: ciphertext,
      version: cred.version + 1,
      rotated_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("version", cred.version)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error: "Alguien cambió esta contraseña recién. Recargá la página antes de rotarla de nuevo.",
    };
  }

  await logVaultEvents([
    { event: "rotated", credentialId: id, credentialName: cred.name, actorId: guard.viewer.id },
  ]);

  revalidateVault();
  return { ok: true, data: { notified } };
}
