"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";
import { upsertSubClients } from "@/lib/sub-clients/actions";
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
  ProjectWithRelations,
} from "./types";
import {
  computePrice,
  editorCostInProject,
} from "./format";
import { PROJECT_SELECT } from "./queries";
import { notifyClientPhaseChange } from "@/lib/discord/notify";
import { nowISOArgentina, todayAR, currentMonthKeyAR } from "@/lib/argentina-date";

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
     * Fecha de terminado (ISO o YYYY-MM-DD). Solo se aplica si phase es
     * "terminado"; si se omite y el proyecto se marca terminado, se usa
     * la fecha actual.
     */
    finalized_at: z.string().nullable().optional(),
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
            .min(1, "El título del proyecto hijo es obligatorio")
            .max(120),
          // Los hijos de un pack pueden ser cualquier tipo excepto "pack"
          // (no soportamos anidación de packs).
          project_type: projectTypeEnum
            .exclude(["pack"])
            .default("long_form"),
          sub_client: z.string().max(80).nullable().default(null),
        })
      )
      .default([]),
  });

export type ProjectInput = z.input<typeof projectInputSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateAll() {
  revalidateTag(CACHE_TAGS.projects, {});
  revalidateTag(CACHE_TAGS.clients, {});
  revalidateTag(CACHE_TAGS.finanzas, {});
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

  // Si vino con hijos (pack), creamos cada uno con su tipo y defaults mínimos.
  if (children.length > 0) {
    const childRows = children.map((c) => ({
      title: c.title,
      client_id: projectData.client_id,
      client_name: clientName,
      project_type: c.project_type,
      parent_id: created.id,
      sub_client: c.sub_client ?? null,
      phase: "por_asignar" as const,
      cobrado: "no" as const,
      pagado: "sin_pagar" as const,
      invoiced: "no" as const,
    }));
    const { error: childErr } = await supabase
      .from("projects")
      .insert(childRows as never);
    if (childErr) return { ok: false, error: childErr.message };

    // Persistir subclientas nuevas en la tabla sub_clients
    if (projectData.client_id) {
      const subClientNames = children
        .map((c) => c.sub_client)
        .filter((n): n is string => Boolean(n));
      await upsertSubClients(projectData.client_id, subClientNames);
    }
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

  const { editors, children, finalized_at, ...projectData } = parsed.data;

  const supabase = await createClient();
  const clientName = await getClientName(projectData.client_id);

  // La fase "terminado" implica finalized=true. Las demás → false.
  // finalized_at: si se va a terminado y el form manda una fecha, se usa esa;
  // si no, solo se setea hoy cuando no había fecha previa (el drag-to-terminado
  // la maneja por su cuenta vía reorderProjects).
  const isTerminado = projectData.phase === "terminado";
  const resolvedFinalizedAt = isTerminado
    ? finalized_at
      ? finalized_at.includes("T")
        ? finalized_at
        : `${finalized_at}T12:00:00Z`
      : nowISOArgentina()
    : null; // limpiar finalized_at al sacar de terminado (evita que finanzas lo bucketice en el mes viejo)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: any = {
    ...projectData,
    client_name: clientName,
    finalized: isTerminado,
    ...(resolvedFinalizedAt !== undefined
      ? { finalized_at: resolvedFinalizedAt }
      : {}),
  };

  const { error } = await supabase
    .from("projects")
    .update(updatePayload)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  // Si el hijo sale de "terminado" (no finalizado) y tiene pack padre,
  // reabrir el padre también (un pack no puede estar terminado con hijos abiertos).
  if (!isTerminado && projectData.parent_id) {
    const { error: parentReopenErr } = await supabase
      .from("projects")
      .update({ finalized: false, finalized_at: null })
      .eq("id", projectData.parent_id);
    if (parentReopenErr) return { ok: false, error: parentReopenErr.message };
  }

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

  // ── Sync de hijos del pack ────────────────────────────────────────────────
  // 1. Diff de la lista: borramos los que ya no están, actualizamos título y
  //    tipo de los existentes, creamos los nuevos.
  // 2. Propagación de contexto: cliente y editores del pack se aplican a
  //    TODOS los hijos vigentes. Los campos individuales (fase, cobrado,
  //    pagado, duración, etc.) se respetan — cada hijo puede editarse aparte.
  const { data: existingChildren, error: fetchChildErr } = await supabase
    .from("projects")
    .select("id, title, project_type, sub_client")
    .eq("parent_id", id);
  if (fetchChildErr) return { ok: false, error: fetchChildErr.message };

  const existing = (existingChildren ?? []) as {
    id: string;
    title: string;
    project_type: string;
    sub_client: string | null;
  }[];

  // — 1a. Borrar hijos que el form ya no incluye —
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

  // — 1b. Actualizar título, tipo y subcliente de los existentes —
  for (const c of children) {
    if (!c.id) continue;
    const old = existing.find((e) => e.id === c.id);
    const subClientNew = c.sub_client ?? null;
    if (
      old &&
      (old.title !== c.title ||
        old.project_type !== c.project_type ||
        old.sub_client !== subClientNew)
    ) {
      const { error: updErr } = await supabase
        .from("projects")
        .update({ title: c.title, project_type: c.project_type, sub_client: subClientNew })
        .eq("id", c.id);
      if (updErr) return { ok: false, error: updErr.message };
    }
  }

  // — 1c. Crear nuevos hijos —
  const newChildren = children.filter((c) => !c.id);
  if (newChildren.length > 0) {
    const childRows = newChildren.map((c) => ({
      title: c.title,
      client_id: projectData.client_id,
      client_name: clientName,
      project_type: c.project_type,
      parent_id: id,
      sub_client: c.sub_client ?? null,
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

  // — 2. Propagar contexto del pack a sus hijos —
  // Reglas:
  //   • Cliente     → siempre a TODOS los hijos (un pack es de un solo cliente).
  //   • Editores    → solo a hijos NUEVOS (los existentes conservan los suyos).
  //   • Finalizado  → si el pack pasa a terminado/reabierto, se propaga a TODOS.
  if (projectData.project_type === "pack") {
    // Fetch de todos los hijos vigentes (incluye los recién creados)
    const { data: freshChildren } = await supabase
      .from("projects")
      .select("id")
      .eq("parent_id", id);
    const allChildIds = (freshChildren ?? []).map((c) => c.id);

    if (allChildIds.length > 0) {
      // 2a. Propagar cliente a todos
      const { error: clientPropErr } = await supabase
        .from("projects")
        .update({ client_id: projectData.client_id, client_name: clientName })
        .in("id", allChildIds);
      if (clientPropErr) return { ok: false, error: clientPropErr.message };

      // 2b. Propagar finalización a todos los hijos
      const { error: finalPropErr } = await supabase
        .from("projects")
        .update({
          finalized: isTerminado,
          ...(resolvedFinalizedAt !== undefined
            ? { finalized_at: resolvedFinalizedAt }
            : {}),
        })
        .in("id", allChildIds);
      if (finalPropErr) return { ok: false, error: finalPropErr.message };

      // 2c. Asignar editores solo a los hijos recién creados
      const existingIds = new Set(existing.map((e) => e.id));
      const newChildIds = allChildIds.filter((cid) => !existingIds.has(cid));
      if (newChildIds.length > 0 && editors.length > 0) {
        const childEditorRows = newChildIds.flatMap((childId) =>
          buildEditorRows(childId, editors)
        );
        const { error: insEditorsErr } = await supabase
          .from("project_editors")
          .insert(childEditorRows);
        if (insEditorsErr) return { ok: false, error: insEditorsErr.message };
      }

      // Persistir subclientas nuevas en la tabla sub_clients
      if (projectData.client_id) {
        const subClientNames = children
          .map((c) => c.sub_client)
          .filter((n): n is string => Boolean(n));
        await upsertSubClients(projectData.client_id, subClientNames);
      }
    }
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

  // Fetch current phase + client channel before updating
  const { data: before } = await supabase
    .from("projects")
    .select("title, phase, client:clients(name, discord_channel_id)")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("projects")
    .update({ phase: parsed.data })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();

  // Notify client's Discord channel if phase actually changed
  if (before && before.phase !== parsed.data) {
    const client = before.client as { name: string; discord_channel_id: string | null } | null;
    if (client?.discord_channel_id) {
      await notifyClientPhaseChange({
        projectTitle: before.title,
        projectId: id,
        clientChannelId: client.discord_channel_id,
        fromPhase: before.phase,
        toPhase: parsed.data,
        clientName: client.name,
      });
    }
  }

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

type SB = Awaited<ReturnType<typeof createClient>>;

async function _cobradoOne(sb: SB, projectId: string, cobrado: "si" | "no" | "parcial"): Promise<void> {
  if (cobrado === "parcial") {
    await sb.from("projects").update({ cobrado }).eq("id", projectId);
    return;
  }
  await sb.from("project_cobros").delete().eq("project_id", projectId);
  if (cobrado === "si") {
    const { data } = await sb.from("projects").select(PROJECT_SELECT).eq("id", projectId).single();
    if (data) {
      const proj = data as unknown as ProjectWithRelations;
      const total = computePrice(proj);
      if (total != null && total > 0) {
        const finalizedMK = proj.finalized_at?.slice(0, 7);
        const effectiveDate =
          proj.phase === "terminado" && finalizedMK && finalizedMK < currentMonthKeyAR()
            ? proj.finalized_at!.slice(0, 10)
            : todayAR();
        await sb.from("project_cobros").insert({ project_id: projectId, amount: total, paid_at: effectiveDate, note: null });
      }
    }
  }
  await sb.from("projects").update({ cobrado }).eq("id", projectId);
}

/**
 * Cambia cobrado a SI / NO / PARCIAL y sincroniza project_cobros.
 * Si el proyecto es un pack, aplica el mismo estado a todos sus hijos.
 */
export async function applyCobradoToggle(
  id: string,
  cobrado: string
): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };
  if (cobrado !== "si" && cobrado !== "no" && cobrado !== "parcial")
    return { ok: false, error: "Estado de cobro inválido" };

  const sb = await createClient();
  await _cobradoOne(sb, id, cobrado as "si" | "no" | "parcial");

  const { data: children } = await sb.from("projects").select("id").eq("parent_id", id);
  if (children && children.length > 0) {
    await Promise.all(children.map((c) => _cobradoOne(sb, c.id, cobrado as "si" | "no" | "parcial")));
  }

  revalidateAll();
  return { ok: true };
}

async function _pagadoOne(sb: SB, projectId: string, pagado: "pago_total" | "sin_pagar" | "parcial"): Promise<void> {
  if (pagado === "parcial") {
    await sb.from("projects").update({ pagado }).eq("id", projectId);
    return;
  }
  await sb.from("project_editor_pagos").delete().eq("project_id", projectId);
  if (pagado === "pago_total") {
    const { data } = await sb.from("projects").select(PROJECT_SELECT).eq("id", projectId).single();
    if (data) {
      const proj = data as unknown as ProjectWithRelations;
      const currentMK = currentMonthKeyAR();
      const effectiveDate = (() => {
        if (proj.cobrado === "si" && proj.cobros.length > 0) {
          return proj.cobros.reduce((a, b) => (b.paid_at > a.paid_at ? b : a)).paid_at;
        }
        const finalizedMK = proj.finalized_at?.slice(0, 7);
        return proj.phase === "terminado" && finalizedMK && finalizedMK < currentMK
          ? proj.finalized_at!.slice(0, 10)
          : todayAR();
      })();
      for (const assignment of proj.editors) {
        if (!assignment.editor) continue;
        const cost = editorCostInProject(proj, assignment.editor.id);
        if (cost == null || cost === 0) continue;
        await sb.from("project_editor_pagos").insert({
          project_id: projectId,
          editor_id: assignment.editor.id,
          amount: cost,
          paid_at: effectiveDate,
          note: null,
        });
      }
    }
  }
  await sb.from("projects").update({ pagado }).eq("id", projectId);
}

/**
 * Cambia pagado a pago_total / sin_pagar / parcial y sincroniza project_editor_pagos.
 * Si el proyecto es un pack, aplica el mismo estado a todos sus hijos.
 */
export async function applyPagadoToggle(
  id: string,
  pagado: string
): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };
  if (pagado !== "pago_total" && pagado !== "sin_pagar" && pagado !== "parcial")
    return { ok: false, error: "Estado de pago inválido" };

  const sb = await createClient();
  await _pagadoOne(sb, id, pagado as "pago_total" | "sin_pagar" | "parcial");

  const { data: children } = await sb.from("projects").select("id").eq("parent_id", id);
  if (children && children.length > 0) {
    await Promise.all(children.map((c) => _pagadoOne(sb, c.id, pagado as "pago_total" | "sin_pagar" | "parcial")));
  }

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

/**
 * Recalcula el estado `cobrado` del proyecto a partir de la suma actual de
 * cobros vs el precio computado. Se llama después de registrar/borrar.
 *   - sum = 0          → no
 *   - sum >= total     → si
 *   - else             → parcial
 * Si no podemos computar el total (cliente sin precio, mensual, etc.) no
 * tocamos el estado — quedará el valor manual previo.
 */
async function recomputeCobradoStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
) {
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", projectId)
    .single();
  if (!data) return;
  const proj = data as unknown as ProjectWithRelations;
  const total = computePrice(proj);
  if (total == null) return;

  const sum = (proj.cobros ?? []).reduce(
    (s, c) => s + Number(c.amount),
    0
  );

  let next: CobradoStatus;
  if (sum === 0) next = "no";
  else if (sum >= total) next = "si";
  else next = "parcial";

  if (proj.cobrado !== next) {
    await supabase
      .from("projects")
      .update({ cobrado: next })
      .eq("id", projectId);
  }
}

/**
 * Recalcula el estado `pagado` del proyecto. Mira cada editor del proyecto:
 *   - Si NINGÚN editor tiene pagos     → sin_pagar
 *   - Si TODOS los editores están al   → pago_total
 *     día (sum >= cost de c/u)
 *   - En otro caso                     → parcial
 * Si no hay editores asignados o no podemos computar el cost, no tocamos.
 */
async function recomputePagadoStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
) {
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", projectId)
    .single();
  if (!data) return;
  const proj = data as unknown as ProjectWithRelations;
  const editors = proj.editors.filter((e) => e.editor != null);
  if (editors.length === 0) return;

  let allPaid = true;
  let anyPaid = false;
  for (const entry of editors) {
    const editorId = entry.editor!.id;
    const cost = editorCostInProject(proj, editorId);
    const sumForEditor = proj.editor_pagos
      .filter((p) => p.editor_id === editorId)
      .reduce((s, p) => s + Number(p.amount), 0);
    if (sumForEditor > 0) anyPaid = true;
    if (cost == null || sumForEditor < cost) allPaid = false;
  }

  let next: PagadoStatus;
  if (!anyPaid) next = "sin_pagar";
  else if (allPaid) next = "pago_total";
  else next = "parcial";

  if (proj.pagado !== next) {
    await supabase
      .from("projects")
      .update({ pagado: next })
      .eq("id", projectId);
  }
}

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
  await recomputeCobradoStatus(supabase, parsed.data.project_id);
  revalidateAll();
  return { ok: true };
}

export async function deleteCobro(id: string): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };
  const supabase = await createClient();
  const { data: cobro } = await supabase
    .from("project_cobros")
    .select("project_id")
    .eq("id", id)
    .single<{ project_id: string }>();
  const { error } = await supabase.from("project_cobros").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (cobro?.project_id)
    await recomputeCobradoStatus(supabase, cobro.project_id);
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
  await recomputePagadoStatus(supabase, parsed.data.project_id);
  revalidateAll();
  return { ok: true };
}

export async function deleteEditorPago(id: string): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };
  const supabase = await createClient();
  const { data: pago } = await supabase
    .from("project_editor_pagos")
    .select("project_id")
    .eq("id", id)
    .single<{ project_id: string }>();
  const { error } = await supabase
    .from("project_editor_pagos")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (pago?.project_id)
    await recomputePagadoStatus(supabase, pago.project_id);
  revalidateAll();
  return { ok: true };
}

// ====== Clonar proyecto ======

export async function cloneProject(id: string, newTitle: string): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };
  const trimmedTitle = newTitle.trim();
  if (!trimmedTitle) return { ok: false, error: "El título no puede estar vacío" };

  const supabase = await createClient();

  // Traer el proyecto original con sus editores
  const { data: orig, error: fetchErr } = await supabase
    .from("projects")
    .select(
      "title, client_id, client_name, phase, cobrado, pagado, invoiced, price, cost, duration_minutes, parent_id, project_type, finalized, finalized_at"
    )
    .eq("id", id)
    .single<{
      title: string;
      client_id: string | null;
      client_name: string | null;
      phase: ProjectPhase;
      cobrado: CobradoStatus;
      pagado: PagadoStatus;
      invoiced: InvoicedStatus;
      price: number | null;
      cost: number | null;
      duration_minutes: number | null;
      parent_id: string | null;
      project_type: ProjectType;
      finalized: boolean;
      finalized_at: string | null;
    }>();

  if (fetchErr || !orig) {
    return { ok: false, error: fetchErr?.message ?? "Proyecto no encontrado" };
  }

  // Crear copia — project_code lo genera el trigger automáticamente
  const { data: cloned, error: insertErr } = await supabase
    .from("projects")
    .insert({
      title: trimmedTitle,
      client_id: orig.client_id,
      client_name: orig.client_name,
      phase: orig.phase,
      cobrado: orig.cobrado,
      pagado: orig.pagado,
      invoiced: orig.invoiced,
      price: orig.price,
      cost: orig.cost,
      duration_minutes: orig.duration_minutes,
      parent_id: orig.parent_id,
      project_type: orig.project_type,
      finalized: orig.finalized,
      finalized_at: orig.finalized_at,
    } as never)
    .select("id")
    .single<{ id: string }>();

  if (insertErr || !cloned) {
    return { ok: false, error: insertErr?.message ?? "Error al clonar" };
  }

  // Copiar editores del original
  const { data: editorRows } = await supabase
    .from("project_editors")
    .select("editor_id, cost")
    .eq("project_id", id);

  if (editorRows && editorRows.length > 0) {
    const { error: editorErr } = await supabase
      .from("project_editors")
      .insert(
        editorRows.map((e) => ({ project_id: cloned.id, editor_id: e.editor_id, cost: e.cost }))
      );
    if (editorErr) return { ok: false, error: editorErr.message };
  }

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

  const sb = await createClient();
  const { error } = await sb.from("projects").update({ invoiced: parsed.data }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Cascade to children
  await sb.from("projects").update({ invoiced: parsed.data }).eq("parent_id", id);

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
 * Elimina permanentemente un proyecto archivado y todos sus datos asociados.
 * Solo disponible para proyectos que ya están archivados.
 */
export async function deleteProject(id: string): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };

  const supabase = await createClient();

  // Borrar hijos primero (packs)
  const { error: childErr } = await supabase
    .from("projects")
    .delete()
    .eq("parent_id", id);
  if (childErr) return { ok: false, error: childErr.message };

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateAll();
  return { ok: true };
}

/**
 * Marca un proyecto como finalizado (o lo reabre). Al finalizarlo se guarda
 * `finalized_at`: ese es el mes en el que el proyecto entra a Finanzas.
 *
 * Cascada bidireccional:
 *   • Pack → hijos: al finalizar/reabrir un pack, todos sus hijos hacen lo mismo.
 *   • Hijo → padre: al desmarcar un hijo, el pack padre también se reabre
 *     (un pack no puede estar "terminado" si algún hijo no lo está).
 */
export async function setProjectFinalized(
  id: string,
  finalized: boolean
): Promise<ActionResult> {
  if (!uuidRegex.test(id)) return { ok: false, error: "ID inválido" };

  const supabase = await createClient();
  const payload = {
    finalized,
    finalized_at: finalized ? nowISOArgentina() : null,
  };

  // 1. Actualizar el proyecto principal
  const { error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // 2. Propagar hacia abajo: si tiene hijos (pack), aplicarles el mismo cambio
  const { data: children } = await supabase
    .from("projects")
    .select("id")
    .eq("parent_id", id);

  if (children && children.length > 0) {
    const childIds = children.map((c) => c.id);
    const { error: childErr } = await supabase
      .from("projects")
      .update(payload)
      .in("id", childIds);
    if (childErr) return { ok: false, error: childErr.message };
  }

  // 3. Propagar hacia arriba: si se está desmarcando y el proyecto tiene
  //    padre (es hijo de un pack), reabrir el pack padre también.
  if (!finalized) {
    const { data: self } = await supabase
      .from("projects")
      .select("parent_id")
      .eq("id", id)
      .single();

    if (self?.parent_id) {
      const { error: parentErr } = await supabase
        .from("projects")
        .update({ finalized: false, finalized_at: null })
        .eq("id", self.parent_id);
      if (parentErr) return { ok: false, error: parentErr.message };
    }
  }

  revalidateAll();
  return { ok: true };
}

export type ReorderUpdate = {
  id: string;
  phase: ProjectPhase;
  position: number;
  /** Si se mueve a/desde "terminado", indica el nuevo estado de finalización. */
  finalized?: boolean;
  /** ISO string de la fecha de terminado. Solo relevante si finalized=true. */
  finalized_at?: string | null;
  /** Si se pasa, reasigna el paid_at de cobros y editor_pagos del proyecto a esta fecha (YYYY-MM-DD). */
  movePaidAtTo?: string;
};

const reorderSchema = z.array(
  z.object({
    id: z.string().regex(uuidRegex, "ID inválido"),
    phase: phaseEnum,
    position: z.number().int().nonnegative(),
    finalized: z.boolean().optional(),
    finalized_at: z.string().nullable().optional(),
    movePaidAtTo: z.string().optional(),
  })
);

export async function reorderProjects(
  updates: ReorderUpdate[]
): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(updates);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (parsed.data.length === 0) return { ok: true };

  const supabase = await createClient();

  // Fetch current phases to detect actual phase changes for notifications
  const ids = parsed.data.map((u) => u.id);
  const { data: before } = await supabase
    .from("projects")
    .select("id, title, phase, client:clients(name, discord_channel_id)")
    .in("id", ids);
  const beforeMap = new Map((before ?? []).map((p) => [p.id, p]));

  const results = await Promise.all(
    parsed.data.map((u) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        phase: u.phase,
        position: u.position,
      };
      if (u.finalized !== undefined) payload.finalized = u.finalized;
      if ("finalized_at" in u) payload.finalized_at = u.finalized_at ?? null;
      return supabase.from("projects").update(payload).eq("id", u.id);
    })
  );

  const failure = results.find((r) => r.error);
  if (failure?.error) return { ok: false, error: failure.error.message };

  // Reasignar paid_at en cobros y editor_pagos si se movió a un mes histórico
  const paidAtMoves = parsed.data.filter((u) => u.movePaidAtTo);
  if (paidAtMoves.length > 0) {
    await Promise.all(
      paidAtMoves.flatMap((u) => [
        supabase.from("project_cobros").update({ paid_at: u.movePaidAtTo }).eq("project_id", u.id),
        supabase.from("project_editor_pagos").update({ paid_at: u.movePaidAtTo }).eq("project_id", u.id),
      ])
    );
  }

  revalidateAll();

  // Notify client channels for projects whose phase actually changed
  const phaseChanges = parsed.data.filter((u) => {
    const old = beforeMap.get(u.id);
    return old && old.phase !== u.phase;
  });
  await Promise.all(
    phaseChanges.map(async (u) => {
      const old = beforeMap.get(u.id)!;
      const client = old.client as { name: string; discord_channel_id: string | null } | null;
      if (client?.discord_channel_id) {
        await notifyClientPhaseChange({
          projectTitle: old.title,
          projectId: u.id,
          clientChannelId: client.discord_channel_id,
          fromPhase: old.phase,
          toPhase: u.phase,
          clientName: client.name,
        });
      }
    })
  );

  return { ok: true };
}
