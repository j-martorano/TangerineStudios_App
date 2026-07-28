import { unstable_cache } from "next/cache";
import { createBotClient } from "@/lib/supabase/bot";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type {
  ClientEditorPair,
  ClientForProject,
  ClientMini,
  ClientPayment,
  EditorMini,
  EditorPaymentType,
  EditorRow,
  PaymentTier,
  ProjectParentRef,
  ProjectWithRelations,
} from "./types";
import type { EditorPaymentMethod } from "@/lib/payment-methods/queries";

export const PROJECT_SELECT =
  "id, project_code, title, client_name, phase, cobrado, pagado, invoiced, status, price, cost, duration_minutes, position, finalized, finalized_at, archived, archived_at, project_type, parent_id, sub_client, created_at, updated_at, client_id, client:clients(id, name, color, payment_type, agreed_price, retainer_discount_pct), editors:project_editors(cost, editor:editors(id, name, payment_type, rate, flat_amount, tiers:editor_payment_tiers(min_minutes, max_minutes, amount))), cobros:project_cobros(id, amount, paid_at, note), editor_pagos:project_editor_pagos(id, editor_id, amount, paid_at, note)";

export const DEFAULT_PER_PAGE = 20;

// ---- Helpers de config por par cliente-editor ----

type PairConfigRow = {
  payment_type: EditorPaymentType | null;
  rate: number | null;
  flat_amount: number | null;
};

function pairKey(clientId: string, editorId: string): string {
  return `${clientId}|${editorId}`;
}

async function fetchPairConfigMap(): Promise<Map<string, PairConfigRow>> {
  const supabase = createBotClient();
  const { data } = await supabase
    .from("client_editors")
    .select("client_id, editor_id, payment_type, rate, flat_amount");
  const map = new Map<string, PairConfigRow>();
  for (const r of data ?? []) {
    map.set(pairKey(r.client_id, r.editor_id), {
      payment_type: r.payment_type,
      rate: r.rate,
      flat_amount: r.flat_amount,
    });
  }
  return map;
}

async function fetchPairTiersMap(): Promise<Map<string, PaymentTier[]>> {
  const supabase = createBotClient();
  const { data } = await supabase
    .from("client_editor_payment_tiers")
    .select("client_id, editor_id, min_minutes, max_minutes, amount");
  const map = new Map<string, PaymentTier[]>();
  for (const r of data ?? []) {
    const key = pairKey(r.client_id, r.editor_id);
    const arr = map.get(key) ?? [];
    arr.push({
      min_minutes: Number(r.min_minutes),
      max_minutes: Number(r.max_minutes),
      amount: Number(r.amount),
    });
    map.set(key, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.min_minutes - b.min_minutes);
  }
  return map;
}

async function fetchGlobalEditorTiersMap(): Promise<Map<string, PaymentTier[]>> {
  const supabase = createBotClient();
  const { data } = await supabase
    .from("editor_payment_tiers")
    .select("editor_id, min_minutes, max_minutes, amount");
  const map = new Map<string, PaymentTier[]>();
  for (const r of data ?? []) {
    const arr = map.get(r.editor_id) ?? [];
    arr.push({
      min_minutes: Number(r.min_minutes),
      max_minutes: Number(r.max_minutes),
      amount: Number(r.amount),
    });
    map.set(r.editor_id, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.min_minutes - b.min_minutes);
  }
  return map;
}

/**
 * Conecta cada proyecto con su pack padre (si lo tiene) y cada pack con sus
 * hijos. Trabaja sobre el array entero — los refs apuntan a objetos vivos,
 * así que cualquier filtro posterior sigue viendo las relaciones.
 */
function attachParentChildLinks(
  projects: ProjectWithRelations[]
): ProjectWithRelations[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const childrenByParent = new Map<string, ProjectWithRelations[]>();

  for (const p of projects) {
    if (p.parent_id) {
      const arr = childrenByParent.get(p.parent_id) ?? [];
      arr.push(p);
      childrenByParent.set(p.parent_id, arr);
    }
  }

  for (const p of projects) {
    const children = childrenByParent.get(p.id);
    if (children && children.length > 0) {
      p.children = children;
    }
    if (p.parent_id) {
      const parent = byId.get(p.parent_id);
      if (parent) {
        const siblings = childrenByParent.get(parent.id) ?? [];
        const parentRef: ProjectParentRef = {
          id: parent.id,
          title: parent.title,
          totalChildren: siblings.length,
          finalizedChildren: siblings.filter((s) => s.finalized).length,
        };
        p.parent = parentRef;
      }
    }
  }

  return projects;
}

/**
 * Aplica la config del par cliente-editor (si existe) al editor embebido en
 * un proyecto. Si el par define payment_type, el editor "efectivo" usado
 * por computeCost adopta esa config en vez de la global del editor.
 *
 * Para tramos flat_variable: prioridad es par-específico > global del editor.
 * El join profundo de Supabase puede devolver [] vacío incluso cuando el editor
 * tiene tramos globales, por eso se usa el mapa global como fuente confiable.
 */
function applyPairOverrides(
  projects: ProjectWithRelations[],
  pairs: Map<string, PairConfigRow>,
  pairTiers: Map<string, PaymentTier[]>,
  globalTiers: Map<string, PaymentTier[]>
): ProjectWithRelations[] {
  for (const p of projects) {
    if (!p.client_id) continue;
    for (const entry of p.editors) {
      if (!entry.editor) continue;
      const key = pairKey(p.client_id, entry.editor.id);
      const pair = pairs.get(key);
      if (!pair) continue;
      const effectiveRate =
        pair.rate !== null ? pair.rate : entry.editor.rate;
      const effectiveFlatAmount =
        pair.flat_amount !== null ? pair.flat_amount : entry.editor.flat_amount;
      // Only override payment_type when the required parameter for the new
      // type is actually available (e.g. "por_minuto" needs a non-null rate).
      // Without this guard, a pair that sets payment_type="por_minuto" but
      // has no rate silently zeroes out cost for "flat_variable" editors.
      let effectiveType = entry.editor.payment_type;
      if (pair.payment_type) {
        const t = pair.payment_type;
        const usable =
          (t === "por_minuto" && effectiveRate != null) ||
          (t === "flat" && effectiveFlatAmount != null) ||
          t === "flat_variable";
        if (usable) effectiveType = t;
      }
      const effectiveTiers =
        effectiveType === "flat_variable"
          ? (pairTiers.get(key) ?? globalTiers.get(entry.editor.id) ?? [])
          : [];
      entry.editor = {
        ...entry.editor,
        payment_type: effectiveType,
        rate: effectiveRate,
        flat_amount: effectiveFlatAmount,
        tiers: effectiveTiers,
      };
    }
  }
  return projects;
}

// ---- Proyectos ----

const _fetchProjectsCached = unstable_cache(
  async (
    query: string,
    includeArchived: boolean,
    includeFinalized: boolean
  ): Promise<ProjectWithRelations[]> => {
    const supabase = createBotClient();
    let q = supabase.from("projects").select(PROJECT_SELECT);

    if (!includeArchived) q = q.eq("archived", false);
    if (!includeFinalized) q = q.eq("finalized", false);

    if (query.length > 0) {
      const safe = query.replace(/[(),]/g, " ").trim();
      if (safe.length > 0) {
        q = q.or(
          `title.ilike.%${safe}%,client_name.ilike.%${safe}%,project_code.ilike.%${safe}%`
        );
      }
    }

    const [{ data, error }, pairs, pairTiers, globalTiers] = await Promise.all([
      q
        .order("phase")
        .order("position")
        .order("created_at", { ascending: true })
        .order("id"),
      fetchPairConfigMap(),
      fetchPairTiersMap(),
      fetchGlobalEditorTiersMap(),
    ]);
    if (error) throw new Error(error.message);
    const all = (data ?? []) as unknown as ProjectWithRelations[];
    applyPairOverrides(all, pairs, pairTiers, globalTiers);
    attachParentChildLinks(all);
    return includeFinalized ? all : all.filter((p) => !p.finalized);
  },
  ["projects"],
  { tags: [CACHE_TAGS.projects, CACHE_TAGS.clients, CACHE_TAGS.editors] }
);

export async function fetchProjects(
  opts: {
    query?: string;
    includeArchived?: boolean;
    includeFinalized?: boolean;
  } = {}
): Promise<ProjectWithRelations[]> {
  const { query = "", includeArchived = false, includeFinalized = true } = opts;
  return _fetchProjectsCached(query, includeArchived, includeFinalized);
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

const _fetchProjectsListCached = unstable_cache(
  async (query: string, page: number, perPage: number): Promise<ProjectsListResult> => {
    const supabase = createBotClient();
    let q = supabase.from("projects").select(PROJECT_SELECT, { count: "exact" });

    if (query.length > 0) {
      const safe = query.replace(/[(),]/g, " ").trim();
      if (safe.length > 0) {
        q = q.or(
          `title.ilike.%${safe}%,client_name.ilike.%${safe}%,project_code.ilike.%${safe}%`
        );
      }
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const [{ data, error, count }, pairs, pairTiers, globalTiers] = await Promise.all([
      q.order("updated_at", { ascending: false }).range(from, to),
      fetchPairConfigMap(),
      fetchPairTiersMap(),
      fetchGlobalEditorTiersMap(),
    ]);

    if (error) throw new Error(error.message);
    const projects = (data ?? []) as unknown as ProjectWithRelations[];
    return { projects: applyPairOverrides(projects, pairs, pairTiers, globalTiers), total: count ?? 0 };
  },
  ["projects-list"],
  { tags: [CACHE_TAGS.projects, CACHE_TAGS.clients, CACHE_TAGS.editors] }
);

export async function fetchProjectsList(
  opts: ProjectsListOptions = {}
): Promise<ProjectsListResult> {
  const { query = "", page = 1, perPage = DEFAULT_PER_PAGE } = opts;
  return _fetchProjectsListCached(query, page, perPage);
}

// ---- Editores ----

export const fetchEditors = unstable_cache(
  async (): Promise<EditorMini[]> => {
    const supabase = createBotClient();
    const { data, error } = await supabase
      .from("editors")
      .select(
        "id, name, payment_type, rate, flat_amount, tiers:editor_payment_tiers(min_minutes, max_minutes, amount)"
      )
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as EditorMini[];
  },
  ["editors"],
  { tags: [CACHE_TAGS.editors] }
);

export type EditorWithCount = EditorRow & {
  project_count: number;
  clients: ClientMini[];
  client_pairs: ClientEditorPair[];
  payment_methods: EditorPaymentMethod[];
  tiers: PaymentTier[];
  discord_link_token: string | null;
};

const EDITOR_FULL_SELECT =
  "id, name, contact_links, discord_id, discord_link_token, docs_url, payment_type, rate, flat_amount, created_at, project_editors(count), client_editors(payment_type, rate, flat_amount, client:clients(id, name, color, payment_type, agreed_price, retainer_discount_pct)), editor_payment_methods(method_id, info, method:payment_methods(id, name, icon, color)), editor_payment_tiers(min_minutes, max_minutes, amount)";

function mapEditor(
  e: {
    id: string;
    name: string;
    contact_links: unknown;
    discord_id: string | null;
    discord_link_token?: string | null;
    docs_url: string | null;
    payment_type: EditorPaymentType;
    rate: number | null;
    flat_amount: number | null;
    created_at: string;
    project_editors?: { count: number }[] | null;
    client_editors?:
      | {
          payment_type: EditorPaymentType | null;
          rate: number | null;
          flat_amount: number | null;
          client: ClientMini | null;
        }[]
      | null;
    editor_payment_methods?:
      | {
          method_id: string;
          info: string | null;
          method: {
            id: string;
            name: string;
            icon: string | null;
            color: string;
          } | null;
        }[]
      | null;
    editor_payment_tiers?:
      | { min_minutes: number; max_minutes: number; amount: number }[]
      | null;
  },
  pairTiersByEditor: Map<string, Map<string, PaymentTier[]>>
): EditorWithCount {
  const editorTiers = pairTiersByEditor.get(e.id) ?? new Map();
  const client_pairs: ClientEditorPair[] = (e.client_editors ?? [])
    .filter((ce) => ce.client != null)
    .map((ce) => ({
      client: ce.client!,
      payment_type: ce.payment_type,
      rate: ce.rate,
      flat_amount: ce.flat_amount,
      tiers: editorTiers.get(ce.client!.id) ?? [],
    }))
    .sort((a, b) => a.client.name.localeCompare(b.client.name));

  return {
    id: e.id,
    name: e.name,
    contact_links: e.contact_links as import("@/lib/database.types").Json,
    discord_id: e.discord_id,
    discord_link_token: e.discord_link_token ?? null,
    docs_url: e.docs_url,
    payment_type: e.payment_type,
    rate: e.rate,
    flat_amount: e.flat_amount,
    created_at: e.created_at,
    project_count: e.project_editors?.[0]?.count ?? 0,
    clients: client_pairs.map((p) => p.client),
    client_pairs,
    payment_methods: (e.editor_payment_methods ?? [])
      .filter((pm) => pm.method != null)
      .map((pm) => ({
        method_id: pm.method_id,
        name: pm.method!.name,
        info: pm.info,
        icon: pm.method!.icon,
        color: pm.method!.color,
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

async function fetchPairTiersByEditor(
  editorIds: string[]
): Promise<Map<string, Map<string, PaymentTier[]>>> {
  const result = new Map<string, Map<string, PaymentTier[]>>();
  if (editorIds.length === 0) return result;
  const supabase = createBotClient();
  const { data } = await supabase
    .from("client_editor_payment_tiers")
    .select("client_id, editor_id, min_minutes, max_minutes, amount")
    .in("editor_id", editorIds);
  for (const r of data ?? []) {
    let editorMap = result.get(r.editor_id);
    if (!editorMap) {
      editorMap = new Map();
      result.set(r.editor_id, editorMap);
    }
    const arr = editorMap.get(r.client_id) ?? [];
    arr.push({
      min_minutes: Number(r.min_minutes),
      max_minutes: Number(r.max_minutes),
      amount: Number(r.amount),
    });
    editorMap.set(r.client_id, arr);
  }
  for (const editorMap of result.values()) {
    for (const arr of editorMap.values()) {
      arr.sort((a, b) => a.min_minutes - b.min_minutes);
    }
  }
  return result;
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

const _fetchEditorsListCached = unstable_cache(
  async (query: string, page: number, perPage: number): Promise<EditorsListResult> => {
    const supabase = createBotClient();
    let q = supabase.from("editors").select(EDITOR_FULL_SELECT, { count: "exact" });

    if (query.length > 0) {
      const safe = query.replace(/[(),]/g, " ").trim();
      if (safe.length > 0) q = q.ilike("name", `%${safe}%`);
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const { data, error, count } = await q.order("name").range(from, to);
    if (error) throw new Error(error.message);

    const editorIds = (data ?? []).map((e) => e.id);
    const pairTiers = await fetchPairTiersByEditor(editorIds);
    return { editors: (data ?? []).map((e) => mapEditor(e, pairTiers)), total: count ?? 0 };
  },
  ["editors-list"],
  { tags: [CACHE_TAGS.editors, CACHE_TAGS.clients] }
);

export async function fetchEditorsList(
  opts: EditorsListOptions = {}
): Promise<EditorsListResult> {
  const { query = "", page = 1, perPage = DEFAULT_PER_PAGE } = opts;
  return _fetchEditorsListCached(query, page, perPage);
}

// ---- Clientes ----

function consumedMinutes(
  projects: { duration_minutes: number | null; archived: boolean }[]
): number {
  return projects
    .filter((p) => !p.archived)
    .reduce((sum, p) => sum + Number(p.duration_minutes ?? 0), 0);
}

export const fetchClients = unstable_cache(
  async (): Promise<ClientForProject[]> => {
    const supabase = createBotClient();
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, name, color, payment_type, agreed_price, retainer_discount_pct, client_payments(minutes_credited), projects(duration_minutes, archived), client_editors(payment_type, rate, flat_amount, editor:editors(id, name, payment_type, rate, flat_amount, tiers:editor_payment_tiers(min_minutes, max_minutes, amount)))"
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
        editors: (c.client_editors ?? [])
          .map((ce: { payment_type: EditorPaymentType | null; rate: number | null; flat_amount: number | null; editor: EditorMini | null }) => {
            if (!ce.editor) return null;
            const effectiveType = ce.payment_type ?? ce.editor.payment_type;
            return {
              ...ce.editor,
              payment_type: effectiveType,
              rate: ce.rate !== null ? ce.rate : ce.editor.rate,
              flat_amount: ce.flat_amount !== null ? ce.flat_amount : ce.editor.flat_amount,
            };
          })
          .filter((e): e is EditorMini => e != null),
      };
    });
  },
  ["clients"],
  { tags: [CACHE_TAGS.clients, CACHE_TAGS.editors] }
);

import type { ClientRow } from "./types";

export type ClientWithCount = ClientRow & {
  project_count: number;
  editors: EditorMini[];
  minute_balance: number | null;
  payments: ClientPayment[];
};

const CLIENT_FULL_SELECT =
  "id, name, color, payment_type, agreed_price, retainer_discount_pct, billing_name, tax_id, address, city, state, country, contact_links, docs_url, created_at, discord_channel_id, parent_id, projects(duration_minutes, archived), client_editors(editor:editors(id, name, payment_type, rate, flat_amount, tiers:editor_payment_tiers(min_minutes, max_minutes, amount))), client_payments(id, amount, minutes_credited, paid_at, note)";

export const fetchClientsWithCount = unstable_cache(
  async (): Promise<ClientWithCount[]> => {
    const supabase = createBotClient();
    const { data, error } = await supabase
      .from("clients")
      .select(CLIENT_FULL_SELECT)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((c) => mapClient(c));
  },
  ["clients-with-count"],
  { tags: [CACHE_TAGS.clients, CACHE_TAGS.editors, CACHE_TAGS.finanzas] }
);

export const fetchClientsForParentSelect = unstable_cache(
  async (): Promise<{ id: string; name: string }[]> => {
    const supabase = createBotClient();
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .is("parent_id", null)
      .order("name");
    return data ?? [];
  },
  ["clients-for-parent-select"],
  { tags: [CACHE_TAGS.clients] }
);

function mapClient(c: {
  id: string;
  name: string;
  color: string;
  payment_type: ClientRow["payment_type"];
  agreed_price: number | null;
  retainer_discount_pct: number;
  billing_name?: string | null;
  tax_id?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  contact_links: unknown;
  docs_url: string | null;
  created_at: string;
  discord_channel_id?: string | null;
  parent_id?: string | null;
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
    billing_name: c.billing_name ?? null,
    tax_id: c.tax_id ?? null,
    address: c.address ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    country: c.country ?? null,
    contact_links: c.contact_links as import("@/lib/database.types").Json,
    docs_url: c.docs_url,
    created_at: c.created_at,
    discord_channel_id: c.discord_channel_id ?? null,
    parent_id: c.parent_id ?? null,
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

const _fetchClientsListCached = unstable_cache(
  async (query: string, page: number, perPage: number): Promise<ClientsListResult> => {
    const supabase = createBotClient();
    let q = supabase.from("clients").select(CLIENT_FULL_SELECT, { count: "exact" });

    if (query.length > 0) {
      const safe = query.replace(/[(),]/g, " ").trim();
      if (safe.length > 0) q = q.ilike("name", `%${safe}%`);
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const { data, error, count } = await q.order("name").range(from, to);
    if (error) throw new Error(error.message);
    return { clients: (data ?? []).map((c) => mapClient(c)), total: count ?? 0 };
  },
  ["clients-list"],
  { tags: [CACHE_TAGS.clients, CACHE_TAGS.editors, CACHE_TAGS.finanzas] }
);

export async function fetchClientsList(
  opts: ClientsListOptions = {}
): Promise<ClientsListResult> {
  const { query = "", page = 1, perPage = DEFAULT_PER_PAGE } = opts;
  return _fetchClientsListCached(query, page, perPage);
}

