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

import type { EditorRow } from "./types";

export type EditorWithCount = EditorRow & {
  project_count: number;
  clients: ClientMini[];
};

const EDITOR_FULL_SELECT =
  "id, name, email, phone, discord_id, bank_info, docs_url, created_at, projects(count), client_editors(client:clients(id, name, color))";

function mapEditor(e: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  discord_id: string | null;
  bank_info: string | null;
  docs_url: string | null;
  created_at: string;
  projects?: { count: number }[] | null;
  client_editors?: { client: ClientMini | null }[] | null;
}): EditorWithCount {
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    phone: e.phone,
    discord_id: e.discord_id,
    bank_info: e.bank_info,
    docs_url: e.docs_url,
    created_at: e.created_at,
    project_count: e.projects?.[0]?.count ?? 0,
    clients: (e.client_editors ?? [])
      .map((ce) => ce.client)
      .filter((c): c is ClientMini => c != null),
  };
}

export type EditorsListOptions = {
  query?: string;
  page?: number;
  perPage?: number;
};

export type EditorsListResult = {
  editors: EditorWithCount[];
  total: number;
};

export async function fetchEditorsList(
  opts: EditorsListOptions = {}
): Promise<EditorsListResult> {
  const { query, page = 1, perPage = DEFAULT_PER_PAGE } = opts;
  const supabase = await createClient();

  let q = supabase
    .from("editors")
    .select(EDITOR_FULL_SELECT, { count: "exact" });

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
    editors: (data ?? []).map((e) => mapEditor(e)),
    total: count ?? 0,
  };
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

import type { ClientRow } from "./types";

export type ClientWithCount = ClientRow & {
  project_count: number;
  editors: EditorMini[];
};

const CLIENT_FULL_SELECT =
  "id, name, color, payment_type, balance, agreed_price, billing_info, email, phone, docs_url, created_at, projects(count), client_editors(editor:editors(id, name))";

export async function fetchClientsWithCount(): Promise<ClientWithCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_FULL_SELECT)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => mapClient(c));
}

function mapClient(c: {
  id: string;
  name: string;
  color: string;
  payment_type: ClientRow["payment_type"];
  balance: number;
  agreed_price: number | null;
  billing_info: string | null;
  email: string | null;
  phone: string | null;
  docs_url: string | null;
  created_at: string;
  projects?: { count: number }[] | null;
  client_editors?: { editor: EditorMini | null }[] | null;
}): ClientWithCount {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    payment_type: c.payment_type,
    balance: c.balance,
    agreed_price: c.agreed_price,
    billing_info: c.billing_info,
    email: c.email,
    phone: c.phone,
    docs_url: c.docs_url,
    created_at: c.created_at,
    project_count: c.projects?.[0]?.count ?? 0,
    editors: (c.client_editors ?? [])
      .map((ce) => ce.editor)
      .filter((e): e is EditorMini => e != null),
  };
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
    .select(CLIENT_FULL_SELECT, { count: "exact" });

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
    clients: (data ?? []).map((c) => mapClient(c)),
    total: count ?? 0,
  };
}
