"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ColumnsIcon,
  KeySquareIcon,
  FilmIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TableIcon,
  UserCogIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { signOut } from "@/lib/auth/actions";
import { TABS, type TabKey } from "@/lib/auth/tabs";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";

const ICONS: Record<TabKey, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  kanban: ColumnsIcon,
  projects: TableIcon,
  clients: UsersIcon,
  editors: FilmIcon,
  finanzas: WalletIcon,
  facturas: ReceiptIcon,
  boveda: KeyRoundIcon,
  configuracion: SettingsIcon,
  mantenimiento: WrenchIcon,
};

type Props = {
  /** Pestañas que el usuario puede ver (ya resueltas en el servidor). */
  tabs: TabKey[];
  isAdmin: boolean;
  userLabel: string;
  /** Avisos sin leer de la Bóveda (contraseñas rotadas). */
  vaultUnread: number;
};

export function AppSidebar({ tabs, isAdmin, userLabel, vaultUnread }: Props) {
  // Solo se renderizan las pestañas habilitadas: las demás no aparecen.
  const items: {
    href: string;
    label: string;
    exact: boolean;
    icon: LucideIcon;
    badge: number | null;
  }[] = TABS.filter((t) => tabs.includes(t.key)).map((t) => ({
    href: t.href,
    label: t.label,
    exact: t.exact,
    icon: ICONS[t.key],
    badge: t.key === "boveda" && vaultUnread > 0 ? vaultUnread : null,
  }));
  if (isAdmin) {
    items.push({
      href: "/usuarios",
      label: "Usuarios",
      exact: false,
      icon: UserCogIcon,
      badge: null,
    });
  }
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [passwordOpen, setPasswordOpen] = useState(false);

  function handleLogout() {
    startTransition(async () => {
      try {
        await signOut();
      } catch {
        toast.error("No se pudo cerrar sesión");
      }
    });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center">
          <Image
            src="/branding/Logo_Y_Texto_Transparente.png"
            alt="Tangerine Studios"
            width={180}
            height={40}
            priority
            unoptimized
            className="h-9 w-auto object-contain group-data-[collapsible=icon]:hidden"
          />
          <Image
            src="/branding/Logo_Icono.png"
            alt="Tangerine Studios"
            width={32}
            height={32}
            priority
            unoptimized
            className="hidden size-8 shrink-0 object-contain group-data-[collapsible=icon]:block"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <item.icon className="shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.badge ? (
                      <SidebarMenuBadge className="bg-[#FFAC37] text-black">
                        {item.badge}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div
              className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
              title={userLabel}
            >
              {isAdmin ? <ShieldCheckIcon className="size-3.5 shrink-0 text-[#FFAC37]" /> : null}
              <span className="truncate">{userLabel}</span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setPasswordOpen(true)}
              tooltip="Cambiar mi contraseña"
            >
              <KeySquareIcon />
              <span>Cambiar mi contraseña</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              disabled={pending}
              tooltip="Cerrar sesión"
            >
              <LogOutIcon />
              <span>{pending ? "Saliendo…" : "Cerrar sesión"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </Sidebar>
  );
}
