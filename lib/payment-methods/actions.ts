"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "./queries";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio")
  .max(60, "El nombre no puede tener más de 60 caracteres");

export type PaymentMethodCreateResult =
  | { ok: true; method: PaymentMethod }
  | { ok: false; error: string };

export type PaymentMethodResult =
  | { ok: true }
  | { ok: false; error: string };

function revalidateEditors() {
  revalidatePath("/editors");
}

/** Crea un método nuevo en el catálogo global. */
export async function createPaymentMethod(input: {
  name: string;
}): Promise<PaymentMethodCreateResult> {
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .insert({ name: parsed.data })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un método con ese nombre" };
    }
    return { ok: false, error: error.message };
  }

  revalidateEditors();
  return { ok: true, method: data as PaymentMethod };
}

/**
 * Elimina un método del catálogo de forma permanente. La cascada borra las
 * asignaciones en editor_payment_methods.
 */
export async function deletePaymentMethod(
  id: string
): Promise<PaymentMethodResult> {
  if (!uuidRegex.test(id)) {
    return { ok: false, error: "ID inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateEditors();
  return { ok: true };
}
