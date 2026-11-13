import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { AmountsProvider } from "@/components/ui/amount";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { getViewer } from "@/lib/auth/permissions";
import { countUnreadVaultNotifications } from "@/lib/vault/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Usuario sin perfil o deshabilitado: no ve nada de la app.
  const viewer = await getViewer();
  if (!viewer) redirect("/sin-acceso");

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const vaultUnread = viewer.tabs.includes("boveda")
    ? await countUnreadVaultNotifications(viewer.id)
    : 0;

  return (
    <AmountsProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar
          tabs={viewer.tabs}
          isAdmin={viewer.role === "admin"}
          userLabel={viewer.displayName ?? viewer.email}
          vaultUnread={vaultUnread}
        />
        <SidebarInset>
          <div className="flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AmountsProvider>
  );
}
