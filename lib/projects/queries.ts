import { createClient } from "@/lib/supabase/server";
import type {
  ClientMini,
  EditorMini,
  ProjectWithRelations,
} from "./types";

const PROJECT_SELECT =
  "id, title, client_name, status, price, currency, created_at, updated_at, editor_id, client_id, editor:editors ( id, name ), client:clients ( id, name )";

export async function fetchProjects(): Promise<ProjectWithRelations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProjectWithRelations[];
}

export async function fetchEditors(): Promise<EditorMini[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editors")
    .select("id, name")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as EditorMini[];
}

export async function fetchClients(): Promise<ClientMini[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientMini[];
}

export type ClientWithCount = {
  id: string;
  name: string;
  created_at: string;
  project_count: number;
};

export async function fetchClientsWithCount(): Promise<ClientWithCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, created_at, projects(count)")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    created_at: c.created_at,
    project_count: c.projects?.[0]?.count ?? 0,
  }));
}
