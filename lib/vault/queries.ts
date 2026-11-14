import { createBotClient } from "@/lib/supabase/bot";
import { isCredentialKind, type CredentialKind } from "./presets";

/**
 * Lecturas de la Bóveda. Todas con service role (las tablas no tienen
 * policies) y SIEMPRE filtradas por el usuario que pregunta: el que llama
 * tiene que haber pasado antes por un guard (requireTab("boveda") o
 * requireAdminPage). Nada de esto se cachea: los permisos aplican al instante.
 *
 * Nunca devuelven la contraseña. Para verla hay que llamar a
 * `revealSecret` (lib/vault/actions.ts), que verifica acceso y deja registro.
 */

export type CredentialSummary = {
  id: string;
  name: string;
  kind: CredentialKind;
  username: string | null;
  loginUrl: string | null;
  changePasswordUrl: string | null;
  notes: string | null;
  version: number;
  rotatedAt: string;
};

export type CredentialWithAccess = CredentialSummary & {
  /** ids de los usuarios que la pueden ver */
  userIds: string[];
};

export type VaultNotification = {
  id: string;
  credentialId: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};

export type VaultEventRow = {
  id: string;
  credentialId: string | null;
  /** nombre al momento del evento (sirve si la credencial ya no existe) */
  credentialName: string | null;
  event: string;
  actorId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  createdAt: string;
};

type CredentialRow = {
  id: string;
  name: string;
  kind: string;
  username: string | null;
  login_url: string | null;
  change_password_url: string | null;
  notes: string | null;
  version: number;
  rotated_at: string;
};

const SUMMARY_COLUMNS =
  "id, name, kind, username, login_url, change_password_url, notes, version, rotated_at";

function toSummary(r: CredentialRow): CredentialSummary {
  return {
    id: r.id,
    name: r.name,
    kind: isCredentialKind(r.kind) ? r.kind : "otro",
    username: r.username,
    loginUrl: r.login_url,
    changePasswordUrl: r.change_password_url,
    notes: r.notes,
    version: r.version,
    rotatedAt: r.rotated_at,
  };
}

/** Credenciales que un usuario puede ver (las que tiene habilitadas). */
export async function fetchCredentialsForUser(
  userId: string
): Promise<CredentialSummary[]> {
  const sb = createBotClient();
  const { data: access } = await sb
    .from("vault_access")
    .select("credential_id")
    .eq("user_id", userId);
  const ids = (access ?? []).map((a) => a.credential_id);
  if (ids.length === 0) return [];
  const { data } = await sb
    .from("vault_credentials")
    .select(SUMMARY_COLUMNS)
    .in("id", ids)
    .order("name");
  return ((data ?? []) as CredentialRow[]).map(toSummary);
}

/** Todas las credenciales con su lista de acceso (solo para admin). */
export async function fetchAllCredentials(): Promise<CredentialWithAccess[]> {
  const sb = createBotClient();
  const [{ data: creds }, { data: access }] = await Promise.all([
    sb.from("vault_credentials").select(SUMMARY_COLUMNS).order("name"),
    sb.from("vault_access").select("credential_id, user_id"),
  ]);
  const byCred = new Map<string, string[]>();
  for (const a of access ?? []) {
    const list = byCred.get(a.credential_id) ?? [];
    list.push(a.user_id);
    byCred.set(a.credential_id, list);
  }
  return ((creds ?? []) as CredentialRow[]).map((c) => ({
    ...toSummary(c),
    userIds: byCred.get(c.id) ?? [],
  }));
}

export async function countUnreadVaultNotifications(userId: string): Promise<number> {
  const { count } = await createBotClient()
    .from("vault_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

/** Todos los avisos sin leer, más los últimos leídos. */
export async function fetchVaultNotifications(
  userId: string,
  readLimit = 10
): Promise<VaultNotification[]> {
  const sb = createBotClient();
  const columns = "id, credential_id, message, created_at, read_at";
  const [{ data: unread }, { data: read }] = await Promise.all([
    sb
      .from("vault_notifications")
      .select(columns)
      .eq("user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false }),
    sb
      .from("vault_notifications")
      .select(columns)
      .eq("user_id", userId)
      .not("read_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(readLimit),
  ]);
  return [...(unread ?? []), ...(read ?? [])].map((n) => ({
    id: n.id,
    credentialId: n.credential_id,
    message: n.message,
    createdAt: n.created_at,
    readAt: n.read_at,
  }));
}

/** Últimos eventos de la Bóveda (solo para admin). */
export async function fetchVaultEvents(limit = 40): Promise<VaultEventRow[]> {
  const { data } = await createBotClient()
    .from("vault_events")
    .select(
      "id, credential_id, credential_name, event, actor_id, actor_email, target_user_id, target_email, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((e) => ({
    id: e.id,
    credentialId: e.credential_id,
    credentialName: e.credential_name,
    event: e.event,
    actorId: e.actor_id,
    actorEmail: e.actor_email,
    targetUserId: e.target_user_id,
    targetEmail: e.target_email,
    createdAt: e.created_at,
  }));
}
