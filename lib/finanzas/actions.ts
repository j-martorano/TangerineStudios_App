"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SettlementPartyType = "client_cobro" | "editor_pago";

const partyTypeEnum = z.enum(["client_cobro", "editor_pago"]);
const yearMonthRegex = /^[0-9]{4}-[0-9]{2}$/;
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const settlementSchema = z.object({
  year_month: z.string().regex(yearMonthRegex, "Mes inválido"),
  party_type: partyTypeEnum,
  party_id: z.string().regex(uuidRegex, "ID inválido"),
  settled: z.boolean(),
});

export type SettlementActionResult =
  | { ok: true }
  | { ok: false; error: string };

function revalidateFinanzas() {
  revalidatePath("/finanzas");
  revalidatePath("/");
}

/**
 * Marca o desmarca el settlement mensual de un cliente / editor en un mes.
 * `settled=true` → upsert del row. `settled=false` → delete.
 */
export async function setMonthlySettlement(
  input: z.input<typeof settlementSchema>
): Promise<SettlementActionResult> {
  const parsed = settlementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { year_month, party_type, party_id, settled } = parsed.data;
  const supabase = await createClient();

  if (settled) {
    const { error } = await supabase
      .from("monthly_settlements")
      .upsert(
        { year_month, party_type, party_id },
        { onConflict: "year_month,party_type,party_id" }
      );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("monthly_settlements")
      .delete()
      .eq("year_month", year_month)
      .eq("party_type", party_type)
      .eq("party_id", party_id);
    if (error) return { ok: false, error: error.message };
  }

  revalidateFinanzas();
  return { ok: true };
}
