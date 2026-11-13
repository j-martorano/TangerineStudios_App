import { createBotClient } from "@/lib/supabase/bot";
import { effectiveTabs, type Role, type TabKey } from "@/lib/auth/tabs";

export type AppUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  /** Pestañas otorgadas (para un admin, todas). */
  tabs: TabKey[];
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

/**
 * Todos los usuarios de la app, con su perfil y su último ingreso.
 * Solo para la página /usuarios (el guard requireAdminPage va antes).
 */
export async function fetchUsers(): Promise<AppUser[]> {
  const sb = createBotClient();
  const [{ data: profiles }, authList] = await Promise.all([
    sb
      .from("profiles")
      .select("id, email, display_name, role, allowed_tabs, disabled, created_at")
      .order("created_at"),
    sb.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const lastSignIn = new Map<string, string | null>();
  for (const u of authList.data?.users ?? []) {
    lastSignIn.set(u.id, u.last_sign_in_at ?? null);
  }

  return (profiles ?? []).map((p) => {
    const role: Role = p.role === "admin" ? "admin" : "member";
    return {
      id: p.id,
      email: p.email,
      displayName: p.display_name,
      role,
      tabs: effectiveTabs(role, p.allowed_tabs ?? []),
      disabled: p.disabled,
      createdAt: p.created_at,
      lastSignInAt: lastSignIn.get(p.id) ?? null,
    };
  });
}
