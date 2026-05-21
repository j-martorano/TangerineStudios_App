import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFS, mergePrefs, type UserPrefs } from "./types";

/**
 * Devuelve las preferencias del usuario logueado, mezcladas con los defaults.
 * Si no hay sesión o no hay row guardada, devuelve los defaults.
 */
export async function fetchUserPrefs(): Promise<UserPrefs> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFS;

  const { data, error } = await supabase
    .from("user_settings")
    .select("prefs")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return DEFAULT_PREFS;

  const raw = (data?.prefs ?? null) as Partial<UserPrefs> | null;
  return mergePrefs(raw);
}
