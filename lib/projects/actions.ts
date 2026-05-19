"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  COBRADO_STATUSES,
  INVOICED_STATUSES,
  PAGADO_STATUSES,
  PROJECT_PHASES,
} from "./types";
import type {
  CobradoStatus,
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
    primary_editor_id: z
      .string()
      .regex(uuidRegex, "Editor inválido")
      .nullable(),
    secondary_editor_id: z
      .string()
      .regex(uuidRegex, "Editor secundario inválido")
      .nullable(),
    secondary_editor_cost: z
      .number()
      .nonnegative("El costo no puede ser negativo")
      .nullable(),
  })
  .refine(
    (d) =>
      !d.secondary_editor_id || d.secondary_editor_id !== d.primary_editor_id,
    {
      message: "El segundo editor no puede ser el mismo que el principal",
      path: ["secondary_editor_id"],
    }
  )
  .refine((d) => !d.secondary_editor_cost || d.secondary_editor_id, {
    message: "Hay un costo pero ningún segundo editor asignado",
    path: ["secondary_editor_cost"],
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

type EditorRow = {
  project_id: string;
  editor_id: string;
  role: "primary" | "secondary";
  cost: number | null;
};

function buildEditorRows(
  projectId: string,
  primary: string | null,
  secondary: string | null,
  secondaryCost: number | null
): EditorRow[] {
  const rows: EditorRow[] = [];
  if (primary) {
    rows.push({
      project_id: projectId,
      editor_id: primary,
      role: "primary",
      cost: null,
    });
  }
  if (secondary) {
    rows.push({
      project_id: projectId,
      editor_id: secondary,
      role: "secondary",
      cost: secondaryCost,
    });
  }
  return rows;
}

export async function createProject(
  input: ProjectInput
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const {
    primary_editor_id,
    secondary_editor_id,
    secondary_editor_cost,
    ...projectData
  } = parsed.data;

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

  const editorRows = buildEditorRows(
    created.id,
    primary_editor_id,
    secondary_editor_id,
    secondary_editor_cost
  );

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

  const {
    primary_editor_id,
    secondary_editor_id,
    secondary_editor_cost,
    ...projectData
  } = parsed.data;

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

  const editorRows = buildEditorRows(
    id,
    primary_editor_id,
    secondary_editor_id,
    secondary_editor_cost
  );

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
  const { error } = await supabase
    .from("projects")
    .update({
      archived,
      archived_at: archived ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
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
