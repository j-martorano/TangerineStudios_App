import { unstable_cache } from "next/cache";
import { createCacheClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type FinanzasPayment = {
  id: string;
  amount: number;
  minutes_credited: number;
  paid_at: string;
  note: string | null;
  clientName: string;
  clientColor: string | null;
};

/** Pago de retainer para el kanban (solo client_id, amount, paid_at). */
export type RetainerPayment = {
  client_id: string;
  amount: number;
  paid_at: string; // "YYYY-MM-DD"
};

export const fetchRetainerPayments = unstable_cache(
  async (): Promise<RetainerPayment[]> => {
    const supabase = createCacheClient();
    const { data, error } = await supabase
      .from("client_payments")
      .select("client_id, amount, paid_at");
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      client_id: p.client_id,
      amount: Number(p.amount),
      paid_at: p.paid_at,
    }));
  },
  ["retainer-payments"],
  { tags: [CACHE_TAGS.finanzas, CACHE_TAGS.clients] }
);

export const fetchClientPayments = unstable_cache(
  async (): Promise<FinanzasPayment[]> => {
    const supabase = createCacheClient();
    const { data, error } = await supabase
      .from("client_payments")
      .select(
        "id, amount, minutes_credited, paid_at, note, client:clients(name, color)"
      )
      .order("paid_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      minutes_credited: Number(p.minutes_credited),
      paid_at: p.paid_at,
      note: p.note,
      clientName: p.client?.name ?? "Cliente",
      clientColor: p.client?.color ?? null,
    }));
  },
  ["client-payments"],
  { tags: [CACHE_TAGS.finanzas, CACHE_TAGS.clients] }
);

export type FixedService = {
  id: string;
  name: string;
  monthly_cost: number;
  active: boolean;
  created_at: string;
};

export const fetchFixedServices = unstable_cache(
  async (): Promise<FixedService[]> => {
    const supabase = createCacheClient();
    const { data, error } = await supabase
      .from("fixed_services")
      .select("id, name, monthly_cost, active, created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      monthly_cost: Number(s.monthly_cost),
      active: s.active,
      created_at: s.created_at,
    }));
  },
  ["fixed-services"],
  { tags: [CACHE_TAGS.finanzas] }
);

// ── Historial de gastos por servicio y mes ────────────────────────────────────
// Meses pasados: se leen de esta tabla (editables, independientes del estado
// actual del servicio). Mes actual: siempre derivado de los servicios activos.

export type ServiceMonthEntry = {
  service_id: string;
  year_month: string; // 'YYYY-MM'
  amount: number;
};

export const fetchServiceMonthEntries = unstable_cache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<ServiceMonthEntry[]> => {
    const supabase = createCacheClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("service_month_entries")
      .select("service_id, year_month, amount");
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((e: any) => ({
      service_id: e.service_id,
      year_month: e.year_month,
      amount: Number(e.amount),
    }));
  },
  ["service-month-entries"],
  { tags: [CACHE_TAGS.finanzas] }
);
