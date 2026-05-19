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

// =========================================================================
// Servicios fijos / suscripciones mensuales
// =========================================================================

const fixedServiceSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  monthly_cost: z
    .number({ message: "El costo debe ser un número" })
    .min(0, "El costo no puede ser negativo"),
  active: z.boolean(),
});

export type FixedServiceResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createFixedService(input: {
  name: string;
  monthly_cost: number;
}): Promise<FixedServiceResult> {
  const parsed = fixedServiceSchema.safeParse({ ...input, active: true });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixed_services")
    .insert({
      name: parsed.data.name,
      monthly_cost: parsed.data.monthly_cost,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidateFinanzas();
  return { ok: true, id: data.id };
}

export async function updateFixedService(input: {
  id: string;
  name: string;
  monthly_cost: number;
  active: boolean;
}): Promise<FixedServiceResult> {
  if (!uuidRegex.test(input.id)) {
    return { ok: false, error: "ID inválido" };
  }
  const parsed = fixedServiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fixed_services")
    .update({
      name: parsed.data.name,
      monthly_cost: parsed.data.monthly_cost,
      active: parsed.data.active,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidateFinanzas();
  return { ok: true };
}

export async function deleteFixedService(
  id: string
): Promise<FixedServiceResult> {
  if (!uuidRegex.test(id)) {
    return { ok: false, error: "ID inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fixed_services")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateFinanzas();
  return { ok: true };
}
