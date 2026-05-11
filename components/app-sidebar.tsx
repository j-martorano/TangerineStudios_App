"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ColumnsIcon,
  FilmIcon,
  LayoutDashboardIcon,
  TableIcon,
  UsersIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/kanban", label: "Kanban", icon: ColumnsIcon, exact: false },
  { href: "/projects", label: "Proyectos", icon: TableIcon, exact: false },
  { href: "/clients", label: "Clientes", icon: UsersIcon, exact: false },
  { href: "/editors", label: "Editores", icon: FilmIcon, exact: false },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center">
          {/* Expandido: logo con texto (gradient de marca) */}
          <Image
            src="/branding/Logo_Y_Texto_Transparente.png"
            alt="Tangerine Studios"
            width={180}
            height={40}
            priority
            unoptimized
            className="h-9 w-auto object-contain group-data-[collapsible=icon]:hidden"
          />
          {/* Colapsado: solo el icono */}
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
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const Icon = item.icon;
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
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
