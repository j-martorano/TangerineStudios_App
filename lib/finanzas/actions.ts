"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateFinanzas() {
  revalidatePath("/finanzas");
  revalidatePath("/");
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

// =========================================================================
// Historial de gastos por mes (service_month_entries)
// =========================================================================

const yearMonthRegex = /^\d{4}-\d{2}$/;

export type ServiceMonthResult = { ok: true } | { ok: false; error: string };

/** Inserta o sobreescribe el monto de un servicio en un mes puntual. */
export async function upsertServiceMonthEntry(input: {
  service_id: string;
  year_month: string;
  amount: number;
}): Promise<ServiceMonthResult> {
  if (!uuidRegex.test(input.service_id))
    return { ok: false, error: "ID de servicio inválido" };
  if (!yearMonthRegex.test(input.year_month))
    return { ok: false, error: "Mes inválido" };
  const amount = Number(input.amount);
  if (Number.isNaN(amount) || amount < 0)
    return { ok: false, error: "Monto inválido" };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("service_month_entries")
    .upsert(
      { service_id: input.service_id, year_month: input.year_month, amount },
      { onConflict: "service_id,year_month" }
    );
  if (error) return { ok: false, error: error.message };

  revalidateFinanzas();
  return { ok: true };
}

/** Elimina la entrada de un servicio en un mes (lo excluye de ese mes). */
export async function deleteServiceMonthEntry(input: {
  service_id: string;
  year_month: string;
}): Promise<ServiceMonthResult> {
  if (!uuidRegex.test(input.service_id))
    return { ok: false, error: "ID de servicio inválido" };
  if (!yearMonthRegex.test(input.year_month))
    return { ok: false, error: "Mes inválido" };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("service_month_entries")
    .delete()
    .eq("service_id", input.service_id)
    .eq("year_month", input.year_month);
  if (error) return { ok: false, error: error.message };

  revalidateFinanzas();
  return { ok: true };
}

/**
 * Registra en un mes pasado todos los servicios actualmente activos.
 * Usa ignoreDuplicates para no pisar entradas que el usuario ya corrigió.
 */
export async function seedMonthEntries(
  yearMonth: string
): Promise<ServiceMonthResult> {
  if (!yearMonthRegex.test(yearMonth))
    return { ok: false, error: "Mes inválido" };

  const supabase = await createClient();
  const { data: services, error: svcErr } = await supabase
    .from("fixed_services")
    .select("id, monthly_cost")
    .eq("active", true);
  if (svcErr) return { ok: false, error: svcErr.message };
  if (!services || services.length === 0) return { ok: true };

  const rows = services.map((s) => ({
    service_id: s.id,
    year_month: yearMonth,
    amount: Number(s.monthly_cost),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("service_month_entries")
    .upsert(rows, { onConflict: "service_id,year_month", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };

  revalidateFinanzas();
  return { ok: true };
}
