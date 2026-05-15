"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { PAYMENT_TYPES } from "@/lib/projects/types";
import type { ClientMini, PaymentType } from "@/lib/projects/types";
import { randomClientColor } from "./palette";

const paymentTypeEnum = z.enum(
  PAYMENT_TYPES as [PaymentType, ...PaymentType[]]
);

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

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
  balance: z.number().default(0),
  agreed_price: z.number().nonnegative().nullable().default(null),
  monthly_fee: z.number().nonnegative().nullable().default(null),
  billing_info: z.string().nullable().default(null),
  email: z.string().email("Email inválido").nullable().or(z.literal("")).default(null),
  phone: z.string().nullable().default(null),
  docs_url: z
    .union([z.string().url("URL inválida"), z.literal(""), z.null()])
    .default(null),
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
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/kanban");
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

  const { error: delErr } = await supabase
    .from("client_editors")
    .delete()
    .eq("client_id", clientId);
  if (delErr) return { ok: false, error: delErr.message };

  if (editorIds.length === 0) return { ok: true };

  const { error: insErr } = await supabase
    .from("client_editors")
    .insert(editorIds.map((eid) => ({ client_id: clientId, editor_id: eid })));
  if (insErr) return { ok: false, error: insErr.message };

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
      balance: parsed.data.balance,
      agreed_price: parsed.data.agreed_price,
      monthly_fee: parsed.data.monthly_fee,
      billing_info: parsed.data.billing_info,
      email: normalizeText(parsed.data.email),
      phone: normalizeText(parsed.data.phone),
      docs_url: normalizeUrl(parsed.data.docs_url),
    })
    .select("id, name, color, payment_type, agreed_price, monthly_fee, balance")
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
      balance: parsed.data.balance,
      agreed_price: parsed.data.agreed_price,
      monthly_fee: parsed.data.monthly_fee,
      billing_info: parsed.data.billing_info,
      email: normalizeText(parsed.data.email),
      phone: normalizeText(parsed.data.phone),
      docs_url: normalizeUrl(parsed.data.docs_url),
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
