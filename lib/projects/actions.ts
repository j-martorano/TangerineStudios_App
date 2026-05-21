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

  const { editors, ...projectData } = parsed.data;

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

  revalidateAll();
  return { ok: true };
}

export async function updateProject(
  id: string,
  input: ProjectInput
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { editors, ...projectData } = parsed.data;

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
