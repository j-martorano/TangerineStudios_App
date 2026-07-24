"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProjectTemplate } from "./types";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const fetchTemplates = unstable_cache(
  async (): Promise<ProjectTemplate[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("project_templates")
      .select("*")
      .order("name");
    return (data ?? []) as ProjectTemplate[];
  },
  ["templates"],
  { tags: [CACHE_TAGS.templates] }
);

export async function createTemplate(
  input: Omit<ProjectTemplate, "id" | "created_at">
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_templates").insert(input);
  if (error) return { ok: false, error: error.message };
  revalidateTag(CACHE_TAGS.templates, {});
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTemplate(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_templates")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateTag(CACHE_TAGS.templates, {});
  revalidatePath("/", "layout");
  return { ok: true };
}
