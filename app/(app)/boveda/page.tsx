import { VaultView } from "@/components/boveda/vault-view";
import { requireTab } from "@/lib/auth/permissions";
import { fetchUsers } from "@/lib/users/queries";
import { isVaultConfigured } from "@/lib/vault/crypto";
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

  const [credentials, notifications, users, events] = await Promise.all([
    isAdmin ? fetchAllCredentials() : fetchCredentialsForUser(viewer.id),
    fetchVaultNotifications(viewer.id),
    isAdmin ? fetchUsers() : Promise.resolve([]),
    isAdmin ? fetchVaultEvents() : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-5">
      <VaultView
        isAdmin={isAdmin}
        configured={isVaultConfigured()}
        credentials={credentials}
        notifications={notifications}
        users={users
          .filter((u) => !u.disabled)
          .map((u) => ({
            id: u.id,
            name: u.displayName ?? u.email,
            hasVaultTab: u.tabs.includes("boveda"),
          }))}
        events={events}
        rotateId={params.rotar ?? null}
      />
    </main>
  );
}
