import { headers } from "next/headers";

import { UsersManager } from "@/components/usuarios/users-manager";
import { requireAdminPage } from "@/lib/auth/permissions";
import { fetchUsers } from "@/lib/users/queries";
import { fetchAllCredentials } from "@/lib/vault/queries";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const viewer = await requireAdminPage();
  const [users, credentials, h] = await Promise.all([
    fetchUsers(),
    fetchAllCredentials(),
    headers(),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const appUrl = host ? `${proto}://${host}` : "";

  return (
    <main className="flex w-full flex-col gap-6 p-4 md:p-5">
      <UsersManager
        users={users}
        credentials={credentials.map((c) => ({ id: c.id, name: c.name, userIds: c.userIds }))}
        currentUserId={viewer.id}
        appUrl={appUrl}
      />
    </main>
  );
}
