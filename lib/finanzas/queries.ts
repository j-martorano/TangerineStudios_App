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
