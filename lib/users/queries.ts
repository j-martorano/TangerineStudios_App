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
  /** Ficha de /editors vinculada a esta cuenta, si es un editor. */
  editor: { id: string; name: string; disabledAt: string | null } | null;
};

/**
 * Todos los usuarios de la app, con su perfil, su último ingreso y la ficha
 * de editor vinculada. Solo para la página /usuarios (el guard
 * requireAdminPage va antes).
 */
export async function fetchUsers(): Promise<AppUser[]> {
  const sb = createBotClient();
  const [{ data: profiles }, authList, { data: editors }] = await Promise.all([
    sb
      .from("profiles")
      .select("id, email, display_name, role, allowed_tabs, disabled, created_at")
      .order("created_at"),
    sb.auth.admin.listUsers({ perPage: 1000 }),
    sb.from("editors").select("id, name, disabled_at, user_id").not("user_id", "is", null),
  ]);

  const lastSignIn = new Map<string, string | null>();
  for (const u of authList.data?.users ?? []) {
    lastSignIn.set(u.id, u.last_sign_in_at ?? null);
  }
  const editorByUser = new Map<string, AppUser["editor"]>();
  for (const e of editors ?? []) {
    if (e.user_id) editorByUser.set(e.user_id, { id: e.id, name: e.name, disabledAt: e.disabled_at });
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
      editor: editorByUser.get(p.id) ?? null,
    };
  });
}

export type EditorChoice = {
  id: string;
  name: string;
  /** Cuenta que ya tiene, si tiene. */
  userId: string | null;
  disabledAt: string | null;
};

/** Editores para el selector «Es el editor…» del formulario de usuarios. */
export async function fetchEditorChoices(): Promise<EditorChoice[]> {
  const { data } = await createBotClient()
    .from("editors")
    .select("id, name, user_id, disabled_at")
    .order("name");
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    userId: e.user_id,
    disabledAt: e.disabled_at,
  }));
}
