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
