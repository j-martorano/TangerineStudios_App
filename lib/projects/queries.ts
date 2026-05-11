import { createClient } from "@/lib/supabase/server";
import type {
  ClientMini,
  EditorMini,
  ProjectWithRelations,
} from "./types";

const PROJECT_SELECT =
  "id, title, client_name, status, price, currency, position, created_at, updated_at, editor_id, client_id, editor:editors ( id, name ), client:clients ( id, name )";

export const DEFAULT_PER_PAGE = 20;

export async function fetchProjects(
  opts: { query?: string } = {}
): Promise<ProjectWithRelations[]> {
  const supabase = await createClient();
  let q = supabase.from("projects").select(PROJECT_SELECT);

  if (opts.query && opts.query.length > 0) {
    const safe = opts.query.replace(/[(),]/g, " ").trim();
    if (safe.length > 0) {
      q = q.or(`title.ilike.%${safe}%,client_name.ilike.%${safe}%`);
    }
  }

  const { data, error } = await q.order("status").order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProjectWithRelations[];
}

export type ProjectsListOptions = {
  query?: string;
  page?: number;
  perPage?: number;
};

export type ProjectsListResult = {
  projects: ProjectWithRelations[];
  total: number;
};

export async function fetchProjectsList(
  opts: ProjectsListOptions = {}
): Promise<ProjectsListResult> {
  const { query, page = 1, perPage = DEFAULT_PER_PAGE } = opts;
  const supabase = await createClient();

  let q = supabase
    .from("projects")
    .select(PROJECT_SELECT, { count: "exact" });

  if (query && query.length > 0) {
    // Escapar comas, paréntesis y comillas que rompen la sintaxis de Supabase .or()
    const safe = query.replace(/[(),]/g, " ").trim();
    if (safe.length > 0) {
      q = q.or(`title.ilike.%${safe}%,client_name.ilike.%${safe}%`);
    }
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await q
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  return {
    projects: (data ?? []) as unknown as ProjectWithRelations[],
    total: count ?? 0,
  };
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

export type ClientsListOptions = {
  query?: string;
  page?: number;
  perPage?: number;
};

export type ClientsListResult = {
  clients: ClientWithCount[];
  total: number;
};

export async function fetchClientsList(
  opts: ClientsListOptions = {}
): Promise<ClientsListResult> {
  const { query, page = 1, perPage = DEFAULT_PER_PAGE } = opts;
  const supabase = await createClient();

  let q = supabase
    .from("clients")
    .select("id, name, created_at, projects(count)", { count: "exact" });

  if (query && query.length > 0) {
    const safe = query.replace(/[(),]/g, " ").trim();
    if (safe.length > 0) {
      q = q.ilike("name", `%${safe}%`);
    }
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await q.order("name").range(from, to);
  if (error) throw new Error(error.message);

  return {
    clients: (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      created_at: c.created_at,
      project_count: c.projects?.[0]?.count ?? 0,
    })),
    total: count ?? 0,
  };
}
