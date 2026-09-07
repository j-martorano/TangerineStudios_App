import { cookies } from "next/headers";

import { AppSidebar } from "@/components/app-sidebar";
import { AmountsProvider } from "@/components/ui/amount";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <AmountsProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AmountsProvider>
  );
}
