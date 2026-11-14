import { createBotClient } from "@/lib/supabase/bot";

/**
 * Historial de la Bóveda y "qué contraseñas conoce una persona".
 *
 * Ojo: este archivo NO es "use server" a propósito. Si lo fuera, cada función
 * exportada sería una server action que cualquiera podría llamar desde el
 * navegador. Solo lo usan lib/vault/actions.ts y lib/users/actions.ts después
 * de pasar sus guards.
 */

export type VaultEventKind =
  | "created"
  | "updated"
  | "rotated"
  | "viewed"
  | "access_granted"
  | "access_revoked"
  | "deleted";

export type VaultEventInput = {
  event: VaultEventKind;
  credentialId: string | null;
  credentialName: string | null;
  actorId: string;
  targetUserId?: string | null;
};

/**
 * Registra eventos guardando también el nombre de la credencial y el email de
 * las personas, para que el historial siga legible si después se borran.
 */
export async function logVaultEvents(events: VaultEventInput[]): Promise<void> {
  if (events.length === 0) return;
  const sb = createBotClient();
  const userIds = [
    ...new Set(events.flatMap((e) => [e.actorId, e.targetUserId ?? null]).filter(Boolean)),
  ] as string[];
  const { data: people } = await sb.from("profiles").select("id, email").in("id", userIds);
  const emailOf = new Map((people ?? []).map((p) => [p.id, p.email]));

  const { error } = await sb.from("vault_events").insert(
    events.map((e) => ({
      event: e.event,
      credential_id: e.credentialId,
      credential_name: e.credentialName,
      actor_id: e.actorId,
      actor_email: emailOf.get(e.actorId) ?? null,
      target_user_id: e.targetUserId ?? null,
      target_email: e.targetUserId ? (emailOf.get(e.targetUserId) ?? null) : null,
    }))
  );
  // El historial no debe frenar la acción principal, pero que quede en logs.
  if (error) console.error("[vault] no se pudo registrar el evento:", error.message);
}

/** Una credencial que la persona conocía (para sugerir rotarla). */
export type KnownCredential = { id: string; name: string };

/**
 * Credenciales que una persona conoce o pudo conocer: las que tiene
 * habilitadas hoy y las que vio alguna vez (aunque ya no tenga acceso, o
 * siendo admin sin acceso explícito). Solo credenciales que siguen existiendo.
 */
export async function knownCredentialsFor(userId: string): Promise<KnownCredential[]> {
  const sb = createBotClient();
  const [{ data: access }, { data: viewed }] = await Promise.all([
    sb.from("vault_access").select("credential_id").eq("user_id", userId),
    sb
      .from("vault_events")
      .select("credential_id")
      .eq("actor_id", userId)
      .eq("event", "viewed")
      .not("credential_id", "is", null),
  ]);
  const ids = [
    ...new Set([
      ...(access ?? []).map((a) => a.credential_id),
      ...(viewed ?? []).map((v) => v.credential_id as string),
    ]),
  ];
  if (ids.length === 0) return [];
  const { data: creds } = await sb
    .from("vault_credentials")
    .select("id, name")
    .in("id", ids)
    .order("name");
  return (creds ?? []).map((c) => ({ id: c.id, name: c.name }));
}

export type AccessChange = { added: string[]; removed: string[] };

/**
 * Deja la tabla vault_access igual a `pairs` para las filas de `scope`
 * (una credencial o un usuario). Ignora ids que ya no existen, así una
 * credencial o un usuario borrado en otra pestaña no hace fallar todo.
 * Devuelve qué pares se agregaron y sacaron, o el error.
 */
export async function syncVaultAccess(
  scope: { credentialId: string } | { userId: string },
  wanted: string[]
): Promise<{ ok: true; change: AccessChange } | { ok: false; error: string }> {
  const sb = createBotClient();
  const byCredential = "credentialId" in scope;

  // Filtrar los ids que existen de verdad.
  const unique = [...new Set(wanted)];
  let valid: string[] = [];
  if (unique.length > 0) {
    const { data, error } = byCredential
      ? await sb.from("profiles").select("id").in("id", unique)
      : await sb.from("vault_credentials").select("id").in("id", unique);
    if (error) return { ok: false, error: error.message };
    valid = (data ?? []).map((r) => r.id);
  }

  const currentQuery = byCredential
    ? sb.from("vault_access").select("user_id").eq("credential_id", scope.credentialId)
    : sb.from("vault_access").select("credential_id").eq("user_id", scope.userId);
  const { data: current, error: currentError } = await currentQuery;
  if (currentError) return { ok: false, error: currentError.message };

  const before = new Set(
    (current ?? []).map((r) =>
      byCredential ? (r as { user_id: string }).user_id : (r as { credential_id: string }).credential_id
    )
  );
  const after = new Set(valid);
  const added = [...after].filter((id) => !before.has(id));
  const removed = [...before].filter((id) => !after.has(id));

  const pair = (other: string) =>
    byCredential
      ? { credential_id: scope.credentialId, user_id: other }
      : { credential_id: other, user_id: scope.userId };

  if (added.length > 0) {
    const { error } = await sb.from("vault_access").insert(added.map(pair));
    if (error) return { ok: false, error: error.message };
  }
  if (removed.length > 0) {
    const q = sb.from("vault_access").delete();
    const { error } = byCredential
      ? await q.eq("credential_id", scope.credentialId).in("user_id", removed)
      : await q.eq("user_id", scope.userId).in("credential_id", removed);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, change: { added, removed } };
}
