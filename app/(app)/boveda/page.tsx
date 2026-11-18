import { VaultView } from "@/components/boveda/vault-view";
import { requireTab } from "@/lib/auth/permissions";
import { fetchUsers } from "@/lib/users/queries";
import { vaultKeyProblem } from "@/lib/vault/crypto";
import {
  fetchAllCredentials,
  fetchCredentialsForUser,
  fetchVaultEvents,
  fetchVaultNotifications,
} from "@/lib/vault/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ rotar?: string }>;

export default async function BovedaPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireTab("boveda");
  const isAdmin = viewer.role === "admin";
  const params = await searchParams;
  const keyProblem = vaultKeyProblem();
  const deploy = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const configNote =
    keyProblem === null
      ? null
      : keyProblem.kind === "missing"
        ? `La variable VAULT_ENCRYPTION_KEY no está definida en este deploy${deploy ? ` (${deploy})` : ""}. ` +
          "Revisá en Vercel → Settings → Environment Variables que exista con ese nombre exacto y con el " +
          "ambiente Production marcado, y hacé un Redeploy después de guardarla."
        : `VAULT_ENCRYPTION_KEY está definida, pero el valor no es válido: tiene que ser una clave de 32 bytes ` +
          `en base64 y se leyeron ${keyProblem.bytes}. Volvé a pegar la clave completa y hacé un Redeploy.`;

  const [credentials, notifications, users, events] = await Promise.all([
    isAdmin ? fetchAllCredentials() : fetchCredentialsForUser(viewer.id),
    fetchVaultNotifications(viewer.id),
    isAdmin ? fetchUsers() : Promise.resolve([]),
    isAdmin ? fetchVaultEvents() : Promise.resolve([]),
  ]);

  return (
    <main className="flex w-full flex-col gap-6 p-4 md:p-5">
      <VaultView
        isAdmin={isAdmin}
        configured={keyProblem === null}
        configNote={configNote}
        credentials={credentials}
        notifications={notifications}
        users={users.map((u) => ({
          id: u.id,
          name: u.displayName ?? u.email,
          hasVaultTab: u.tabs.includes("boveda"),
          disabled: u.disabled,
        }))}
        events={events}
        rotateId={params.rotar ?? null}
      />
    </main>
  );
}
