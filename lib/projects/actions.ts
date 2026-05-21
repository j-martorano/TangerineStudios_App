"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  COBRADO_STATUSES,
  INVOICED_STATUSES,
  PAGADO_STATUSES,
  PROJECT_PHASES,
  PROJECT_TYPES,
} from "./types";
import type {
  CobradoStatus,
  InvoicedStatus,
  PagadoStatus,
  ProjectPhase,
  ProjectType,
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
const projectTypeEnum = z.enum(
  PROJECT_TYPES as [ProjectType, ...ProjectType[]]
);

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const projectInputSchema = z
  .object({
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
    cost: z
      .number()
      .nonnegative("El costo no puede ser negativo")
      .nullable(),
    duration_minutes: z
      .number()
      .nonnegative("La duración no puede ser negativa")
      .nullable(),
    /**
     * Editores asignados al proyecto. Cada uno puede tener un `cost` manual
     * (override del cálculo) o null para usar el modelo de pago del editor.
     */
    editors: z
      .array(
        z.object({
          id: z.string().regex(uuidRegex, "Editor inválido"),
          cost: z
            .number()
            .nonnegative("El costo no puede ser negativo")
            .nullable()
            .default(null),
        })
      )
      .default([]),
    project_type: projectTypeEnum.default("long_form"),
    /** Si está seteado, este proyecto es un short hijo del pack indicado. */
    parent_id: z
      .string()
      .regex(uuidRegex, "Padre inválido")
      .nullable()
      .default(null),
    /**
     * Shorts del pack. Cada item con `id` ya existe (sólo se actualiza el
     * título); los items sin `id` se crean como hijos nuevos con defaults
     * mínimos (cliente heredado, phase=por_asignar). Si se omite o queda
     * vacío en edición, los hijos existentes se eliminan.
     */
    children: z
      .array(
        z.object({
          id: z.string().regex(uuidRegex, "ID hijo inválido").optional(),
          title: z
            .string()
            .min(1, "El título del short es obligatorio")
            .max(120),
        })
      )
      .default([]),
  });

export type ProjectInput = z.input<typeof projectInputSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/kanban");
  revalidatePath("/projects");
  revalidatePath("/finanzas");
  revalidatePath("/clients");
  revalidatePath("/editors");
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos";
}

type ProjectEditorRow = {
  project_id: string;
  editor_id: string;
  cost: number | null;
};

function buildEditorRows(
  projectId: string,
  editors: { id: string; cost: number | null }[]
): ProjectEditorRow[] {
  // Dedup por las dudas: la PK del pivot es (project_id, editor_id).
  const byId = new Map<string, { id: string; cost: number | null }>();
  for (const e of editors) if (!byId.has(e.id)) byId.set(e.id, e);
  return [...byId.values()].map((e) => ({
    project_id: projectId,
    editor_id: e.id,
    cost: e.cost,
  }));
}

export async function createProject(
  input: ProjectInput
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { editors, children, ...projectData } = parsed.data;

  const supabase = await createClient();
  const clientName = await getClientName(projectData.client_id);

  // project_code lo rellena el trigger `projects_set_code_trg`. El tipo
  // generado lo marca required → cast a never.
  const { data: created, error } = await supabase
    .from("projects")
    .insert({ ...projectData, client_name: clientName } as never)
    .select("id")
    .single<{ id: string }>();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Error al crear proyecto" };
  }

  const editorRows = buildEditorRows(created.id, editors);

  if (editorRows.length > 0) {
    const { error: editorError } = await supabase
      .from("project_editors")
      .insert(editorRows);
    if (editorError) return { ok: false, error: editorError.message };
  }

  // Si vino con shorts (pack), creamos cada hijo con defaults.
  if (children.length > 0) {
    const childRows = children.map((c) => ({
      title: c.title,
      client_id: projectData.client_id,
      client_name: clientName,
      project_type: "short_form" as const,
      parent_id: created.id,
      phase: "por_asignar" as const,
      cobrado: "no" as const,
      pagado: "sin_pagar" as const,
      invoiced: "no" as const,
    }));
    const { error: childErr } = await supabase
      .from("projects")
      .insert(childRows as never);
    if (childErr) return { ok: false, error: childErr.message };
  }

  revalidateAll();
  return { ok: true };
}

export async function updateProject(
  id: string,
  input: ProjectInput
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { editors, children, ...projectData } = parsed.data;

  const supabase = await createClient();
  const clientName = await getClientName(projectData.client_id);

  const { error } = await supabase
    .from("projects")
    .update({ ...projectData, client_name: clientName })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  // Sync editors: delete-then-insert para mantener la pivot consistente.
  const { error: deleteError } = await supabase
    .from("project_editors")
    .delete()
    .eq("project_id", id);
  if (deleteError) return { ok: false, error: deleteError.message };

  const editorRows = buildEditorRows(id, editors);

  if (editorRows.length > 0) {
    const { error: insertError } = await supabase
      .from("project_editors")
      .insert(editorRows);
    if (insertError) return { ok: false, error: insertError.message };
  }

  // Sync de hijos del pack. Diff entre lo que mandó el form y lo que ya
  // está en DB: borramos lo que ya no aparece, actualizamos los títulos
  // de los que siguen y creamos los nuevos. No tocamos editor, phase,
  // pagado, etc. de los hijos existentes — eso se edita por separado.
  const { data: existingChildren, error: fetchChildErr } = await supabase
    .from("projects")
    .select("id, title")
    .eq("parent_id", id);
  if (fetchChildErr) return { ok: false, error: fetchChildErr.message };

  const existing = (existingChildren ?? []) as { id: string; title: string }[];
  const sentIds = new Set(children.filter((c) => c.id).map((c) => c.id!));
  const idsToDelete = existing
    .filter((c) => !sentIds.has(c.id))
    .map((c) => c.id);

  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("projects")
      .delete()
      .in("id", idsToDelete);
    if (delErr) return { ok: false, error: delErr.message };
  }

  for (const c of children) {
    if (!c.id) continue;
    const old = existing.find((e) => e.id === c.id);
    if (old && old.title !== c.title) {
      const { error: updErr } = await supabase
        .from("projects")
        .update({ title: c.title })
        .eq("id", c.id);
      if (updErr) return { ok: false, error: updErr.message };
    }
  }

  const newChildren = children.filter((c) => !c.id);
  if (newChildren.length > 0) {
    const childRows = newChildren.map((c) => ({
      title: c.title,
      client_id: projectData.client_id,
      client_name: clientName,
      project_type: "short_form" as const,
      parent_id: id,
      phase: "por_asignar" as const,
      cobrado: "no" as const,
      pagado: "sin_pagar" as const,
      invoiced: "no" as const,
    }));
    const { error: insErr } = await supabase
      .from("projects")
      .insert(childRows as never);
    if (insErr) return { ok: false, error: insErr.message };
  }

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

// ====== Cobros parciales por proyecto ======

const cobroInputSchema = z.object({
  project_id: z.string().regex(uuidRegex, "ID de proyecto inválido"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  paid_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  note: z.string().max(200).nullable().optional(),
});

export type CobroInput = z.input<typeof cobroInputSchema>;

export async function registerCobro(
  input: CobroInput
): Promise<ActionResult> {
  const parsed = cobroInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("project_cobros").insert({
    project_id: parsed.data.project_id,
    amount: parsed.data.amount,
    paid_at: parsed.data.paid_at,
    note: parsed.data.note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function deleteCobro(id: string): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };
  const supabase = await createClient();
  const { error } = await supabase.from("project_cobros").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

// ====== Pagos parciales a editores por proyecto ======

const editorPagoInputSchema = z.object({
  project_id: z.string().regex(uuidRegex, "ID de proyecto inválido"),
  editor_id: z.string().regex(uuidRegex, "ID de editor inválido"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  paid_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  note: z.string().max(200).nullable().optional(),
});

export type EditorPagoInput = z.input<typeof editorPagoInputSchema>;

export async function registerEditorPago(
  input: EditorPagoInput
): Promise<ActionResult> {
  const parsed = editorPagoInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("project_editor_pagos").insert({
    project_id: parsed.data.project_id,
    editor_id: parsed.data.editor_id,
    amount: parsed.data.amount,
    paid_at: parsed.data.paid_at,
    note: parsed.data.note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function deleteEditorPago(id: string): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_editor_pagos")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function changeProjectDuration(
  id: string,
  minutes: number | null
): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };
  if (
    minutes !== null &&
    (Number.isNaN(minutes) || minutes < 0)
  ) {
    return { ok: false, error: "Duración inválida" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ duration_minutes: minutes })
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

/**
 * Archiva o desarchiva un proyecto (borrado lógico). Los proyectos nunca se
 * borran de verdad: archivar los saca de las vistas activas pero quedan en el
 * registro.
 */
export async function setProjectArchived(
  id: string,
  archived: boolean
): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };

  const supabase = await createClient();
  const archivedAt = archived ? new Date().toISOString() : null;

  // El proyecto en sí + sus hijos en cascada. Si es un pack, archivar el
  // padre archiva también todos los shorts; desarchivar hace lo opuesto.
  const { error: ownErr } = await supabase
    .from("projects")
    .update({ archived, archived_at: archivedAt })
    .eq("id", id);
  if (ownErr) return { ok: false, error: ownErr.message };

  const { error: childErr } = await supabase
    .from("projects")
    .update({ archived, archived_at: archivedAt })
    .eq("parent_id", id);
  if (childErr) return { ok: false, error: childErr.message };

  revalidateAll();
  return { ok: true };
}

/**
 * Marca un proyecto como finalizado (o lo reabre). Al finalizarlo se guarda
 * `finalized_at`: ese es el mes en el que el proyecto entra a Finanzas.
 */
export async function setProjectFinalized(
  id: string,
  finalized: boolean
): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      finalized,
      finalized_at: finalized ? new Date().toISOString() : null,
    })
    .eq("id", id);

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
