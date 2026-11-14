import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createBotClient } from "@/lib/supabase/bot";
import {
  TABS,
  effectiveTabs,
  type Role,
  type TabKey,
  type ViewerProfile,
} from "./tabs";
import { SCOPES, type Scope } from "./scopes";

/**
 * Perfil del usuario logueado, leído una vez por request.
 *
 * El usuario sale de la sesión (cookie verificada por Supabase con getUser);
 * el perfil se lee con service role para no depender de RLS. No se cachea
 * entre requests: un cambio de permisos tiene que aplicar en el próximo click.
 *
 * Devuelve null si no hay sesión, no hay perfil o el usuario está
 * deshabilitado.
 */
export const getViewer = cache(async (): Promise<ViewerProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await createBotClient()
    .from("profiles")
    .select("id, email, display_name, role, allowed_tabs, disabled")
    .eq("id", user.id)
    .maybeSingle();

  // La tabla todavía no existe: el código nuevo llegó a producción antes que
  // la migración (o la migración falló). Hasta que exista, todo usuario
  // logueado sigue con acceso total, como antes de este sistema, en vez de
  // quedar todos afuera sin poder arreglarlo desde la app.
  if (error && (error.code === "PGRST205" || error.code === "42P01")) {
    console.error("[auth] falta la tabla profiles: ¿se aplicó la migración de usuarios?");
    return {
      id: user.id,
      email: user.email ?? "",
      displayName: null,
      role: "admin",
      tabs: effectiveTabs("admin", []),
    };
  }

  if (!profile || profile.disabled) return null;

  const role: Role = profile.role === "admin" ? "admin" : "member";
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    role,
    tabs: effectiveTabs(role, profile.allowed_tabs ?? []),
  };
});

/** Primera pestaña que el usuario puede ver, para mandarlo ahí. */
export function homeFor(viewer: ViewerProfile): string | null {
  const first = TABS.find((t) => viewer.tabs.includes(t.key));
  return first?.href ?? null;
}

/**
 * Guard de página. Sin sesión → /login. Sin permiso → 404 (la página "no
 * existe" para quien no la tiene habilitada).
 */
export async function requireTab(tab: TabKey): Promise<ViewerProfile> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sin-acceso");
  if (!viewer.tabs.includes(tab)) notFound();
  return viewer;
}

/** Guard de página solo-admin (/usuarios). */
export async function requireAdminPage(): Promise<ViewerProfile> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sin-acceso");
  if (viewer.role !== "admin") notFound();
  return viewer;
}

export type GuardResult =
  | { ok: true; viewer: ViewerProfile }
  | { ok: false; error: string };

/** Guard para server actions solo-admin. */
export async function assertAdmin(): Promise<GuardResult> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") {
    return { ok: false, error: "No tenés permiso para hacer esto" };
  }
  return { ok: true, viewer };
}

/**
 * Guard para server actions: pasa si el usuario es admin o tiene alguna de
 * las pestañas del scope (ver lib/auth/scopes.ts).
 */
export async function assertScope(scope: Scope): Promise<GuardResult> {
  const viewer = await getViewer();
  const tabs: readonly TabKey[] = SCOPES[scope];
  if (!viewer || !tabs.some((t) => viewer.tabs.includes(t))) {
    return { ok: false, error: "No tenés permiso para hacer esto" };
  }
  return { ok: true, viewer };
}

/** Igual que assertScope pero tira error (para actions que no devuelven Result). */
export async function requireScope(scope: Scope): Promise<ViewerProfile> {
  const res = await assertScope(scope);
  if (!res.ok) throw new Error(res.error);
  return res.viewer;
}

/** Guard para server actions de una pestaña. */
export async function assertTab(tab: TabKey): Promise<GuardResult> {
  const viewer = await getViewer();
  if (!viewer || !viewer.tabs.includes(tab)) {
    return { ok: false, error: "No tenés permiso para hacer esto" };
  }
  return { ok: true, viewer };
}
