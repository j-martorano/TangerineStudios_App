"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  COBRADO_STATUSES,
  CURRENCIES,
  INVOICED_STATUSES,
  PAGADO_STATUSES,
  PROJECT_PHASES,
} from "./types";
import type {
  CobradoStatus,
  CurrencyCode,
  InvoicedStatus,
  PagadoStatus,
  ProjectPhase,
} from "./types";

async function getClientName(clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();
  return data?.name ?? null;
}

const phaseEnum = z.enum(PROJECT_PHASES as [ProjectPhase, ...ProjectPhase[]]);
const cobradoEnum = z.enum(
  COBRADO_STATUSES as [CobradoStatus, ...CobradoStatus[]]
);
const pagadoEnum = z.enum(
  PAGADO_STATUSES as [PagadoStatus, ...PagadoStatus[]]
);
const invoicedEnum = z.enum(
  INVOICED_STATUSES as [InvoicedStatus, ...InvoicedStatus[]]
);
const currencyEnum = z.enum(CURRENCIES as [CurrencyCode, ...CurrencyCode[]]);

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const projectInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título es obligatorio")
    .max(120, "El título no puede tener más de 120 caracteres"),
  client_id: z.string().regex(uuidRegex, "Cliente inválido").nullable(),
  phase: phaseEnum,
  cobrado: cobradoEnum.default("no"),
  pagado: pagadoEnum.default("sin_pagar"),
  invoiced: invoicedEnum.default("no"),
  price: z
    .number()
    .nonnegative("El precio no puede ser negativo")
    .nullable(),
  currency: currencyEnum,
  editor_id: z.string().regex(uuidRegex, "Editor inválido").nullable(),
});

export type ProjectInput = z.input<typeof projectInputSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/kanban");
  revalidatePath("/projects");
  revalidatePath("/clients");
  revalidatePath("/editors");
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos";
}

export async function createProject(
  input: ProjectInput
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const clientName = await getClientName(parsed.data.client_id);
  const { error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, client_name: clientName });

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function updateProject(
  id: string,
  input: ProjectInput
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const clientName = await getClientName(parsed.data.client_id);
  const { error } = await supabase
    .from("projects")
    .update({ ...parsed.data, client_name: clientName })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function changePhase(
  id: string,
  phase: ProjectPhase
): Promise<ActionResult> {
  const parsed = phaseEnum.safeParse(phase);
  if (!parsed.success) return { ok: false, error: "Fase inválida" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ phase: parsed.data })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function changeCobrado(
  id: string,
  cobrado: CobradoStatus
): Promise<ActionResult> {
  const parsed = cobradoEnum.safeParse(cobrado);
  if (!parsed.success) return { ok: false, error: "Estado de cobro inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ cobrado: parsed.data })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function changePagado(
  id: string,
  pagado: PagadoStatus
): Promise<ActionResult> {
  const parsed = pagadoEnum.safeParse(pagado);
  if (!parsed.success) return { ok: false, error: "Estado de pago inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ pagado: parsed.data })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function changeInvoiced(
  id: string,
  invoiced: InvoicedStatus
): Promise<ActionResult> {
  const parsed = invoicedEnum.safeParse(invoiced);
  if (!parsed.success)
    return { ok: false, error: "Estado de facturación inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ invoiced: parsed.data })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export type ReorderUpdate = {
  id: string;
  phase: ProjectPhase;
  position: number;
};

const reorderSchema = z.array(
  z.object({
    id: z.string().regex(uuidRegex, "ID inválido"),
    phase: phaseEnum,
    position: z.number().int().nonnegative(),
  })
);

export async function reorderProjects(
  updates: ReorderUpdate[]
): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(updates);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (parsed.data.length === 0) return { ok: true };

  const supabase = await createClient();
  const results = await Promise.all(
    parsed.data.map((u) =>
      supabase
        .from("projects")
        .update({ phase: u.phase, position: u.position })
        .eq("id", u.id)
    )
  );

  const failure = results.find((r) => r.error);
  if (failure?.error) return { ok: false, error: failure.error.message };

  revalidateAll();
  return { ok: true };
}
