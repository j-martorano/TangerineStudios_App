"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "./queries";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

const nameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio")
  .max(60, "El nombre no puede tener más de 60 caracteres");

const iconSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .nullable()
  .default(null);

const colorSchema = z
  .string()
  .regex(hexColorRegex, "El color debe ser un hex como #aabbcc")
  .default("#888888");

const createSchema = z.object({
  name: nameSchema,
  icon: iconSchema,
  color: colorSchema,
});

const updateSchema = z.object({
  id: z.string().regex(uuidRegex, "ID inválido"),
  name: nameSchema,
  icon: iconSchema,
  color: colorSchema,
});

export type PaymentMethodCreateResult =
  | { ok: true; method: PaymentMethod }
  | { ok: false; error: string };

export type PaymentMethodResult =
  | { ok: true }
  | { ok: false; error: string };

function revalidateEditors() {
  revalidatePath("/editors");
  revalidatePath("/configuracion");
}

/** Crea un método nuevo en el catálogo global. */
export async function createPaymentMethod(input: {
  name: string;
  icon?: string | null;
  color?: string;
}): Promise<PaymentMethodCreateResult> {
  const parsed = createSchema.safeParse({
    name: input.name,
    icon: input.icon ?? null,
    color: input.color ?? "#888888",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .insert({
      name: parsed.data.name,
      icon: parsed.data.icon,
      color: parsed.data.color,
    })
    .select("id, name, icon, color")
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

/** Actualiza un método del catálogo (nombre, ícono o color). */
export async function updatePaymentMethod(input: {
  id: string;
  name: string;
  icon: string | null;
  color: string;
}): Promise<PaymentMethodResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_methods")
    .update({
      name: parsed.data.name,
      icon: parsed.data.icon,
      color: parsed.data.color,
    })
    .eq("id", parsed.data.id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un método con ese nombre" };
    }
    return { ok: false, error: error.message };
  }

  revalidateEditors();
  return { ok: true };
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
