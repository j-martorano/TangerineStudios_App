import { UsersManager } from "@/components/usuarios/users-manager";
import { getAppUrl } from "@/lib/app-url";
import { requireAdminPage } from "@/lib/auth/permissions";
import { fetchEditorChoices, fetchUsers } from "@/lib/users/queries";
import { fetchAllCredentials } from "@/lib/vault/queries";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const viewer = await requireAdminPage();
  const [users, credentials, editors, appUrl] = await Promise.all([
    fetchUsers(),
    fetchAllCredentials(),
    fetchEditorChoices(),
    getAppUrl(),
  ]);

  return (
    <main className="flex w-full flex-col gap-6 p-4 md:p-5">
      <UsersManager
        users={users}
        credentials={credentials.map((c) => ({ id: c.id, name: c.name, userIds: c.userIds }))}
        editors={editors}
        currentUserId={viewer.id}
        appUrl={appUrl}
      />
    </main>
  );
}
