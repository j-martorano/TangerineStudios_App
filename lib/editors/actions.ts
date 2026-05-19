"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { EDITOR_PAYMENT_TYPES } from "@/lib/projects/types";
import type { EditorMini, EditorPaymentType } from "@/lib/projects/types";

const editorPaymentTypeEnum = z.enum(
  EDITOR_PAYMENT_TYPES as [EditorPaymentType, ...EditorPaymentType[]]
);

const editorInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "El nombre no puede tener más de 120 caracteres"),
  email: z
    .union([z.string().email("Email inválido"), z.literal(""), z.null()])
    .default(null),
  phone: z.string().nullable().default(null),
  discord_id: z.string().nullable().default(null),
  docs_url: z
    .union([z.string().url("URL inválida"), z.literal(""), z.null()])
    .default(null),
  payment_type: editorPaymentTypeEnum.default("por_minuto"),
  rate: z
    .number()
    .nonnegative("El rate por minuto no puede ser negativo")
    .nullable()
    .default(null),
  flat_amount: z
    .number()
    .nonnegative("El monto FLAT no puede ser negativo")
    .nullable()
    .default(null),
  /** Tramos de FLAT variable. Si está definido, se sincroniza la tabla. */
  tiers: z
    .array(
      z
        .object({
          min_minutes: z
            .number()
            .nonnegative("Los minutos no pueden ser negativos"),
          max_minutes: z
            .number()
            .positive("El máximo de minutos debe ser mayor a 0"),
          amount: z
            .number()
            .nonnegative("El monto del tramo no puede ser negativo"),
        })
        .refine((t) => t.max_minutes > t.min_minutes, {
          message: "En cada tramo el máximo debe ser mayor al mínimo",
        })
    )
    .optional(),
  /** IDs de clientes asignados. Si está definido, se sincroniza la pivot client_editors. */
  client_ids: z.array(z.string()).optional(),
  /** Métodos de pago del editor + info. Si está definido, se sincroniza la pivot. */
  payment_methods: z
    .array(
      z.object({
        method_id: z.string(),
        info: z.string().nullable().default(null),
      })
    )
    .optional(),
});

export type EditorInput = z.input<typeof editorInputSchema>;

export type EditorActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type EditorCreateResult =
  | { ok: true; editor: EditorMini }
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

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function syncEditorClients(
  editorId: string,
  clientIds: string[] | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (clientIds === undefined) return { ok: true };
  const supabase = await createSupabaseClient();

  const { error: delErr } = await supabase
    .from("client_editors")
    .delete()
    .eq("editor_id", editorId);
  if (delErr) return { ok: false, error: delErr.message };

  if (clientIds.length === 0) return { ok: true };

  const { error: insErr } = await supabase
    .from("client_editors")
    .insert(clientIds.map((cid) => ({ client_id: cid, editor_id: editorId })));
  if (insErr) return { ok: false, error: insErr.message };

  return { ok: true };
}

async function syncEditorPaymentMethods(
  editorId: string,
  methods: { method_id: string; info: string | null }[] | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (methods === undefined) return { ok: true };
  const supabase = await createSupabaseClient();

  const { error: delErr } = await supabase
    .from("editor_payment_methods")
    .delete()
    .eq("editor_id", editorId);
  if (delErr) return { ok: false, error: delErr.message };

  if (methods.length === 0) return { ok: true };

  const { error: insErr } = await supabase
    .from("editor_payment_methods")
    .insert(
      methods.map((m) => ({
        editor_id: editorId,
        method_id: m.method_id,
        info: normalizeText(m.info),
      }))
    );
  if (insErr) return { ok: false, error: insErr.message };

  return { ok: true };
}

async function syncEditorPaymentTiers(
  editorId: string,
  tiers:
    | { min_minutes: number; max_minutes: number; amount: number }[]
    | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (tiers === undefined) return { ok: true };
  const supabase = await createSupabaseClient();

  const { error: delErr } = await supabase
    .from("editor_payment_tiers")
    .delete()
    .eq("editor_id", editorId);
  if (delErr) return { ok: false, error: delErr.message };

  if (tiers.length === 0) return { ok: true };

  const { error: insErr } = await supabase
    .from("editor_payment_tiers")
    .insert(
      tiers.map((t) => ({
        editor_id: editorId,
        min_minutes: t.min_minutes,
        max_minutes: t.max_minutes,
        amount: t.amount,
      }))
    );
  if (insErr) return { ok: false, error: insErr.message };

  return { ok: true };
}

export async function createEditor(
  input: EditorInput
): Promise<EditorCreateResult> {
  const parsed = editorInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("editors")
    .insert({
      name: parsed.data.name,
      email: normalizeText(parsed.data.email),
      phone: normalizeText(parsed.data.phone),
      discord_id: normalizeText(parsed.data.discord_id),
      docs_url: normalizeText(parsed.data.docs_url),
      payment_type: parsed.data.payment_type,
      rate:
        parsed.data.payment_type === "por_minuto" ? parsed.data.rate : null,
      flat_amount:
        parsed.data.payment_type === "flat" ? parsed.data.flat_amount : null,
    })
    .select("id, name, payment_type, rate, flat_amount")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un editor con ese Discord ID" };
    }
    return { ok: false, error: error.message };
  }

  const sync = await syncEditorClients(data.id, parsed.data.client_ids);
  if (!sync.ok) return { ok: false, error: sync.error };

  const syncPm = await syncEditorPaymentMethods(
    data.id,
    parsed.data.payment_methods
  );
  if (!syncPm.ok) return { ok: false, error: syncPm.error };

  const syncTiers = await syncEditorPaymentTiers(
    data.id,
    parsed.data.payment_type === "flat_variable" ? parsed.data.tiers : []
  );
  if (!syncTiers.ok) return { ok: false, error: syncTiers.error };

  revalidateAll();
  return { ok: true, editor: { ...data, tiers: [] } as EditorMini };
}

export async function updateEditor(
  id: string,
  input: EditorInput
): Promise<EditorActionResult> {
  const parsed = editorInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("editors")
    .update({
      name: parsed.data.name,
      email: normalizeText(parsed.data.email),
      phone: normalizeText(parsed.data.phone),
      discord_id: normalizeText(parsed.data.discord_id),
      docs_url: normalizeText(parsed.data.docs_url),
      payment_type: parsed.data.payment_type,
      rate:
        parsed.data.payment_type === "por_minuto" ? parsed.data.rate : null,
      flat_amount:
        parsed.data.payment_type === "flat" ? parsed.data.flat_amount : null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un editor con ese Discord ID" };
    }
    return { ok: false, error: error.message };
  }

  const sync = await syncEditorClients(id, parsed.data.client_ids);
  if (!sync.ok) return { ok: false, error: sync.error };

  const syncPm = await syncEditorPaymentMethods(
    id,
    parsed.data.payment_methods
  );
  if (!syncPm.ok) return { ok: false, error: syncPm.error };

  const syncTiers = await syncEditorPaymentTiers(
    id,
    parsed.data.payment_type === "flat_variable" ? parsed.data.tiers : []
  );
  if (!syncTiers.ok) return { ok: false, error: syncTiers.error };

  revalidateAll();
  return { ok: true };
}

export async function deleteEditor(id: string): Promise<EditorActionResult> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("editors").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}
