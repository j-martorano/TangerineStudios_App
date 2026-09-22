"use server";

import { z } from "zod";
import { todayAR } from "@/lib/argentina-date";
import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { PAYMENT_TYPES } from "@/lib/projects/types";
import type { ClientMini, PaymentType } from "@/lib/projects/types";
import { randomClientColor } from "./palette";

const paymentTypeEnum = z.enum(
  PAYMENT_TYPES as [PaymentType, ...PaymentType[]]
);

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const clientInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "El nombre no puede tener más de 120 caracteres"),
  color: z
    .string()
    .regex(hexColorRegex, "Color inválido (esperado #RRGGBB)")
    .optional(),
  payment_type: paymentTypeEnum.default("por_proyecto"),
  /** Rate por minuto — usado por clientes por_rate y mensuales. */
  agreed_price: z.number().nonnegative().nullable().default(null),
  /** % de descuento del retainer (sólo aplica a clientes mensuales). */
  retainer_discount_pct: z
    .number()
    .min(0, "El descuento no puede ser negativo")
    .max(100, "El descuento no puede superar 100%")
    .default(10),
  billing_name: z.string().nullable().default(null),
  tax_id: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  city: z.string().nullable().default(null),
  state: z.string().nullable().default(null),
  country: z.string().nullable().default(null),
  contact_links: z
    .array(z.object({ type: z.string(), value: z.string() }))
    .default([]),
  docs_url: z
    .union([z.string().url("URL inválida"), z.literal(""), z.null()])
    .default(null),
  discord_channel_id: z.string().nullable().default(null),
  parent_id: z.string().uuid("ID de cliente padre inválido").nullable().default(null),
  /** IDs de editores asignados. Si está definido, se sincroniza la pivot client_editors. */
  editor_ids: z.array(z.string()).optional(),
});

export type ClientInput = z.input<typeof clientInputSchema>;

export type ClientActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type ClientCreateResult =
  | { ok: true; client: ClientMini }
  | { ok: false; error: string };

function revalidateAll() {
  revalidateTag(CACHE_TAGS.clients, {});
  revalidateTag(CACHE_TAGS.projects, {});
  revalidateTag(CACHE_TAGS.finanzas, {});
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/kanban");
  revalidatePath("/finanzas");
  revalidatePath("/editors");
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos";
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function syncClientEditors(
  clientId: string,
  editorIds: string[] | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (editorIds === undefined) return { ok: true };
  const supabase = await createSupabaseClient();

  // OJO: acá NO se puede borrar todo y re-insertar. La fila de client_editors
  // guarda además la config de pago del par (payment_type, rate, flat_amount)
  // y los tramos por rango cuelgan de ella con ON DELETE CASCADE. El form de
  // cliente no maneja esa config, así que un delete+insert la borraba entera y
  // el editor volvía a su modelo global — por ejemplo un editor con 10/min
  // para un cliente pasaba a cobrar los tramos de otro.
  // Tocamos sólo las altas y las bajas; los pares que siguen, quedan intactos.
  const { data: existing, error: selErr } = await supabase
    .from("client_editors")
    .select("editor_id")
    .eq("client_id", clientId);
  if (selErr) return { ok: false, error: selErr.message };

  const current = new Set((existing ?? []).map((r) => r.editor_id));
  const next = new Set(editorIds);

  const toRemove = [...current].filter((id) => !next.has(id));
  if (toRemove.length > 0) {
    const { error: delErr } = await supabase
      .from("client_editors")
      .delete()
      .eq("client_id", clientId)
      .in("editor_id", toRemove);
    if (delErr) return { ok: false, error: delErr.message };
  }

  const toAdd = [...next].filter((id) => !current.has(id));
  if (toAdd.length > 0) {
    const { error: insErr } = await supabase
      .from("client_editors")
      .insert(toAdd.map((eid) => ({ client_id: clientId, editor_id: eid })));
    if (insErr) return { ok: false, error: insErr.message };
  }

  return { ok: true };
}

export async function createClient(
  input: ClientInput
): Promise<ClientCreateResult> {
  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: parsed.data.name,
      color: parsed.data.color ?? randomClientColor(),
      payment_type: parsed.data.payment_type,
      agreed_price: parsed.data.agreed_price,
      retainer_discount_pct: parsed.data.retainer_discount_pct,
      billing_name: normalizeText(parsed.data.billing_name),
      tax_id: normalizeText(parsed.data.tax_id),
      address: normalizeText(parsed.data.address),
      city: normalizeText(parsed.data.city),
      state: normalizeText(parsed.data.state),
      country: normalizeText(parsed.data.country),
      contact_links: parsed.data.contact_links.filter((l) => l.value.trim()),
      docs_url: normalizeUrl(parsed.data.docs_url),
      discord_channel_id: normalizeText(parsed.data.discord_channel_id),
      parent_id: parsed.data.parent_id,
    })
    .select(
      "id, name, color, payment_type, agreed_price, retainer_discount_pct"
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un cliente con ese nombre" };
    }
    return { ok: false, error: error.message };
  }

  const sync = await syncClientEditors(data.id, parsed.data.editor_ids);
  if (!sync.ok) return { ok: false, error: sync.error };

  revalidateAll();
  return { ok: true, client: data as ClientMini };
}

export async function updateClient(
  id: string,
  input: ClientInput
): Promise<ClientActionResult> {
  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name: parsed.data.name,
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
      payment_type: parsed.data.payment_type,
      agreed_price: parsed.data.agreed_price,
      retainer_discount_pct: parsed.data.retainer_discount_pct,
      billing_name: normalizeText(parsed.data.billing_name),
      tax_id: normalizeText(parsed.data.tax_id),
      address: normalizeText(parsed.data.address),
      city: normalizeText(parsed.data.city),
      state: normalizeText(parsed.data.state),
      country: normalizeText(parsed.data.country),
      contact_links: parsed.data.contact_links.filter((l) => l.value.trim()),
      docs_url: normalizeUrl(parsed.data.docs_url),
      discord_channel_id: normalizeText(parsed.data.discord_channel_id),
      parent_id: parsed.data.parent_id,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un cliente con ese nombre" };
    }
    return { ok: false, error: error.message };
  }

  const sync = await syncClientEditors(id, parsed.data.editor_ids);
  if (!sync.ok) return { ok: false, error: sync.error };

  revalidateAll();
  return { ok: true };
}

export async function deleteClient(id: string): Promise<ClientActionResult> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

// =========================================================================
// Pagos de clientes mensuales
// =========================================================================

const paymentSchema = z.object({
  client_id: z.string().regex(uuidRegex, "Cliente inválido"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  paid_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  note: z.string().nullable().default(null),
});

export type ClientPaymentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Tasa efectiva por minuto de un cliente mensual: el rate con el descuento
 * de retainer aplicado.
 */
function effectiveRate(
  rate: number | null,
  discountPct: number
): number | null {
  if (rate == null || rate <= 0) return null;
  const eff = rate * (1 - discountPct / 100);
  return eff > 0 ? eff : null;
}

/**
 * Registra un pago de un cliente mensual. El monto se convierte a minutos
 * usando el rate efectivo (rate − descuento de retainer) del momento.
 */
export async function registerClientPayment(input: {
  client_id: string;
  amount: number;
  paid_at: string;
  note?: string | null;
}): Promise<ClientPaymentResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createSupabaseClient();
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("agreed_price, retainer_discount_pct")
    .eq("id", parsed.data.client_id)
    .single();
  if (clientErr || !client) {
    return { ok: false, error: "Cliente no encontrado" };
  }

  const eff = effectiveRate(
    client.agreed_price == null ? null : Number(client.agreed_price),
    Number(client.retainer_discount_pct)
  );
  if (eff == null) {
    return {
      ok: false,
      error: "El cliente no tiene un rate por minuto válido cargado",
    };
  }

  const minutes = parsed.data.amount / eff;
  const { error } = await supabase.from("client_payments").insert({
    client_id: parsed.data.client_id,
    amount: parsed.data.amount,
    minutes_credited: minutes,
    paid_at: parsed.data.paid_at,
    note: normalizeText(parsed.data.note),
  });
  if (error) return { ok: false, error: error.message };

  revalidateAll();
  return { ok: true };
}

// -------------------------------------------------------------------------
// Ajustes: restar minutos del saldo mensual
// -------------------------------------------------------------------------

const minutesDebitSchema = z.object({
  client_id: z.string().regex(uuidRegex, "Cliente inválido"),
  minutes: z
    .number()
    .positive("Los minutos a restar deben ser mayores a 0")
    .max(100000, "Cantidad de minutos demasiado grande"),
  note: z.string().nullable().default(null),
});

/**
 * Resta minutos del saldo de un cliente mensual. Se guarda como un registro
 * más de `client_payments` con `amount = 0` y `minutes_credited` negativo,
 * fechado el día del registro (hora Argentina). Así el saldo (acreditados −
 * consumidos) lo absorbe sin tocar los ingresos.
 */
export async function registerClientMinutesDebit(input: {
  client_id: string;
  minutes: number;
  note?: string | null;
}): Promise<ClientPaymentResult> {
  const parsed = minutesDebitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createSupabaseClient();
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("payment_type")
    .eq("id", parsed.data.client_id)
    .single();
  if (clientErr || !client) {
    return { ok: false, error: "Cliente no encontrado" };
  }
  if (client.payment_type !== "mensual") {
    return {
      ok: false,
      error: "Solo los clientes mensuales tienen saldo de minutos",
    };
  }

  const { error } = await supabase.from("client_payments").insert({
    client_id: parsed.data.client_id,
    amount: 0,
    minutes_credited: -parsed.data.minutes,
    paid_at: todayAR(),
    note: normalizeText(parsed.data.note),
  });
  if (error) return { ok: false, error: error.message };

  revalidateAll();
  return { ok: true };
}

export async function deleteClientPayment(
  id: string
): Promise<ClientPaymentResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("client_payments")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateAll();
  return { ok: true };
}
