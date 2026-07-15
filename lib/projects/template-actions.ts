"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProjectTemplate } from "./types";

export async function fetchTemplates(): Promise<ProjectTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_templates")
    .select("*")
    .order("name");
  return (data ?? []) as ProjectTemplate[];
}

export async function createTemplate(
  input: Omit<ProjectTemplate, "id" | "created_at">
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_templates").insert(input);
  if (error) return { ok: false, error: error.message };
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
  revalidatePath("/", "layout");
  return { ok: true };
}
