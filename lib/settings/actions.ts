"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { mergePrefs, type UserPrefs } from "./types";

export type PrefsActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Actualiza las preferencias del usuario logueado. Hace upsert mezclando con
 * lo guardado (merge a nivel de sección, no profundo dentro de cada array).
 */
export async function updateUserPrefs(
  patch: Partial<UserPrefs>
): Promise<PrefsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No hay sesión activa" };

  const { data: existing } = await supabase
    .from("user_settings")
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();

  const current = mergePrefs(
    (existing?.prefs ?? null) as Partial<UserPrefs> | null
  );

  const merged: UserPrefs = {
    columns: {
      projects: patch.columns?.projects ?? current.columns.projects,
      editors: patch.columns?.editors ?? current.columns.editors,
      clients: patch.columns?.clients ?? current.columns.clients,
    },
    finanzas: {
      tabs: patch.finanzas?.tabs ?? current.finanzas.tabs,
    },
    limits: {
      projects_per_year:
        patch.limits?.projects_per_year ?? current.limits.projects_per_year,
      editors_per_page:
        patch.limits?.editors_per_page ?? current.limits.editors_per_page,
      clients_per_page:
        patch.limits?.clients_per_page ?? current.limits.clients_per_page,
    },
  };

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      prefs: merged,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };

  // Las prefs afectan a todas las páginas — revalidamos el layout.
  revalidatePath("/", "layout");
  return { ok: true };
}
