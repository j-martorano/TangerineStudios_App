import { createClient } from "@/lib/supabase/server";
import type {
  ClientForProject,
  ClientMini,
  ClientPayment,
  EditorMini,
  ProjectWithRelations,
} from "./types";

const PROJECT_SELECT =
  "id, project_code, title, client_name, phase, cobrado, pagado, invoiced, status, price, cost, duration_minutes, position, finalized, finalized_at, archived, archived_at, created_at, updated_at, client_id, client:clients(id, name, color, payment_type, agreed_price, retainer_discount_pct), editors:project_editors(cost, editor:editors(id, name, payment_type, rate, flat_amount, tiers:editor_payment_tiers(min_minutes, max_minutes, amount)))";

export const DEFAULT_PER_PAGE = 20;

export async function fetchProjects(
  opts: {
    query?: string;
    /** Incluir proyectos archivados (borrado lógico). Por defecto se ocultan. */
    includeArchived?: boolean;
    /** Incluir proyectos finalizados. Por defecto sí (el kanban los excluye). */
    includeFinalized?: boolean;
  } = {}
): Promise<ProjectWithRelations[]> {
  const { query, includeArchived = false, includeFinalized = true } = opts;
  const supabase = await createClient();
  let q = supabase.from("projects").select(PROJECT_SELECT);

  if (!includeArchived) q = q.eq("archived", false);
  if (!includeFinalized) q = q.eq("finalized", false);

  if (query && query.length > 0) {
    const safe = query.replace(/[(),]/g, " ").trim();
    if (safe.length > 0) {
      q = q.or(
        `title.ilike.%${safe}%,client_name.ilike.%${safe}%,project_code.ilike.%${safe}%`
      );
    }
  }

  const { data, error } = await q.order("phase").order("position");
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
      q = q.or(
        `title.ilike.%${safe}%,client_name.ilike.%${safe}%,project_code.ilike.%${safe}%`
      );
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
    .select(
      "id, name, payment_type, rate, flat_amount, tiers:editor_payment_tiers(min_minutes, max_minutes, amount)"
    )
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EditorMini[];
}

import type { EditorRow, PaymentTier } from "./types";
import type { EditorPaymentMethod } from "@/lib/payment-methods/queries";

export type EditorWithCount = EditorRow & {
  project_count: number;
  clients: ClientMini[];
  payment_methods: EditorPaymentMethod[];
  tiers: PaymentTier[];
};

const EDITOR_FULL_SELECT =
  "id, name, email, phone, discord_id, docs_url, payment_type, rate, flat_amount, created_at, project_editors(count), client_editors(client:clients(id, name, color, payment_type, agreed_price, retainer_discount_pct)), editor_payment_methods(method_id, info, method:payment_methods(id, name)), editor_payment_tiers(min_minutes, max_minutes, amount)";

import type { EditorPaymentType } from "./types";

function mapEditor(e: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  discord_id: string | null;
  docs_url: string | null;
  payment_type: EditorPaymentType;
  rate: number | null;
  flat_amount: number | null;
  created_at: string;
  project_editors?: { count: number }[] | null;
  client_editors?: { client: ClientMini | null }[] | null;
  editor_payment_methods?:
    | {
        method_id: string;
        info: string | null;
        method: { id: string; name: string } | null;
      }[]
    | null;
  editor_payment_tiers?:
    | { min_minutes: number; max_minutes: number; amount: number }[]
    | null;
}): EditorWithCount {
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    phone: e.phone,
    discord_id: e.discord_id,
    docs_url: e.docs_url,
    payment_type: e.payment_type,
    rate: e.rate,
    flat_amount: e.flat_amount,
    created_at: e.created_at,
    project_count: e.project_editors?.[0]?.count ?? 0,
    clients: (e.client_editors ?? [])
      .map((ce) => ce.client)
      .filter((c): c is ClientMini => c != null),
    payment_methods: (e.editor_payment_methods ?? [])
      .filter((pm) => pm.method != null)
      .map((pm) => ({
        method_id: pm.method_id,
        name: pm.method!.name,
        info: pm.info,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    tiers: (e.editor_payment_tiers ?? [])
      .map((t) => ({
        min_minutes: Number(t.min_minutes),
        max_minutes: Number(t.max_minutes),
        amount: Number(t.amount),
      }))
      .sort((a, b) => a.min_minutes - b.min_minutes),
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

// Suma de minutos consumidos por los proyectos no archivados de un cliente.
function consumedMinutes(
  projects: { duration_minutes: number | null; archived: boolean }[]
): number {
  return projects
    .filter((p) => !p.archived)
    .reduce((sum, p) => sum + Number(p.duration_minutes ?? 0), 0);
}

export async function fetchClients(): Promise<ClientForProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, name, color, payment_type, agreed_price, retainer_discount_pct, client_payments(minutes_credited), projects(duration_minutes, archived)"
    )
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => {
    const credited = (c.client_payments ?? []).reduce(
      (sum, p) => sum + Number(p.minutes_credited),
      0
    );
    const consumed = consumedMinutes(c.projects ?? []);
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      payment_type: c.payment_type,
      agreed_price: c.agreed_price,
      retainer_discount_pct: c.retainer_discount_pct,
      minute_balance:
        c.payment_type === "mensual" ? credited - consumed : null,
    };
  });
}

import type { ClientRow } from "./types";

export type ClientWithCount = ClientRow & {
  project_count: number;
  editors: EditorMini[];
  /** Saldo de minutos (sólo para clientes mensuales). */
  minute_balance: number | null;
  payments: ClientPayment[];
};

const CLIENT_FULL_SELECT =
  "id, name, color, payment_type, agreed_price, retainer_discount_pct, billing_info, email, phone, docs_url, created_at, projects(duration_minutes, archived), client_editors(editor:editors(id, name, payment_type, rate, flat_amount, tiers:editor_payment_tiers(min_minutes, max_minutes, amount))), client_payments(id, amount, minutes_credited, paid_at, note)";

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
  agreed_price: number | null;
  retainer_discount_pct: number;
  billing_info: string | null;
  email: string | null;
  phone: string | null;
  docs_url: string | null;
  created_at: string;
  projects?: { duration_minutes: number | null; archived: boolean }[] | null;
  client_editors?: { editor: EditorMini | null }[] | null;
  client_payments?:
    | {
        id: string;
        amount: number;
        minutes_credited: number;
        paid_at: string;
        note: string | null;
      }[]
    | null;
}): ClientWithCount {
  const projects = c.projects ?? [];
  const credited = (c.client_payments ?? []).reduce(
    (sum, p) => sum + Number(p.minutes_credited),
    0
  );
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    payment_type: c.payment_type,
    agreed_price: c.agreed_price,
    retainer_discount_pct: c.retainer_discount_pct,
    billing_info: c.billing_info,
    email: c.email,
    phone: c.phone,
    docs_url: c.docs_url,
    created_at: c.created_at,
    project_count: projects.filter((p) => !p.archived).length,
    editors: (c.client_editors ?? [])
      .map((ce) => ce.editor)
      .filter((e): e is EditorMini => e != null),
    minute_balance:
      c.payment_type === "mensual"
        ? credited - consumedMinutes(projects)
        : null,
    payments: (c.client_payments ?? [])
      .map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        minutes_credited: Number(p.minutes_credited),
        paid_at: p.paid_at,
        note: p.note,
      }))
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at)),
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
