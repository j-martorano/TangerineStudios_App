import { createClient } from "@/lib/supabase/server";

export type FinanzasPayment = {
  id: string;
  amount: number;
  minutes_credited: number;
  paid_at: string;
  note: string | null;
  clientName: string;
  clientColor: string | null;
};

export async function fetchClientPayments(): Promise<FinanzasPayment[]> {
  const supabase = await createClient();
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
}

export type FixedService = {
  id: string;
  name: string;
  monthly_cost: number;
  active: boolean;
  created_at: string;
};

export async function fetchFixedServices(): Promise<FixedService[]> {
  const supabase = await createClient();
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
}
