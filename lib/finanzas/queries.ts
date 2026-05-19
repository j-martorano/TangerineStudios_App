import { createClient } from "@/lib/supabase/server";

export type SettlementKey = string; // `${year_month}|${party_type}|${party_id}`

export function settlementKey(
  yearMonth: string,
  partyType: "client_cobro" | "editor_pago",
  partyId: string
): SettlementKey {
  return `${yearMonth}|${partyType}|${partyId}`;
}

export async function fetchSettlements(): Promise<Set<SettlementKey>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_settlements")
    .select("year_month, party_type, party_id");
  if (error) throw new Error(error.message);
  return new Set(
    (data ?? []).map((r) =>
      settlementKey(r.year_month, r.party_type, r.party_id)
    )
  );
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
