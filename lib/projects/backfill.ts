"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { PROJECT_SELECT } from "./queries";
import { computePrice, editorCostInProject } from "./format";
import { todayAR } from "@/lib/argentina-date";
import type { ProjectWithRelations } from "./types";

export type BackfillPreviewItem = {
  id: string;
  code: string;
  title: string;
  clientName: string;
  kind: "cobrado" | "pagado";
  amount: number | null;
  paidAt: string;
};

export type BackfillPreview = {
  items: BackfillPreviewItem[];
  cobroCount: number;
  pagadoCount: number;
};

function effectiveDateForProject(proj: ProjectWithRelations): string {
  if (proj.cobrado === "si" && proj.cobros.length > 0) {
    return proj.cobros.reduce((a, b) => (b.paid_at > a.paid_at ? b : a)).paid_at;
  }
  if (proj.phase === "terminado" && proj.finalized_at) {
    return proj.finalized_at.slice(0, 10);
  }
  const fallback = proj.finalized_at ?? proj.created_at;
  return fallback ? fallback.slice(0, 10) : todayAR();
}

/** Solo proyectos raíz (no hijos de pack) con el flag activo pero sin registros. */
async function fetchAffectedProjects(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .is("parent_id", null)
    .eq("archived", false);

  if (error) throw new Error(error.message);
  const all = (data ?? []) as unknown as ProjectWithRelations[];

  const needsCobro = all.filter(
    (p) =>
      p.cobrado === "si" &&
      p.client?.payment_type !== "mensual" &&
      p.cobros.length === 0
  );

  const needsPagado = all.filter(
    (p) =>
      p.pagado === "pago_total" &&
      p.client?.payment_type !== "mensual" &&
      p.editor_pagos.length === 0 &&
      p.editors.some((e) => e.editor != null)
  );

  return { needsCobro, needsPagado };
}

export async function previewBackfill(): Promise<BackfillPreview> {
  const supabase = await createClient();
  const { needsCobro, needsPagado } = await fetchAffectedProjects(supabase);

  const items: BackfillPreviewItem[] = [];

  for (const p of needsCobro) {
    const amount = computePrice(p);
    items.push({
      id: p.id,
      code: p.project_code ?? "—",
      title: p.title,
      clientName: p.client?.name ?? p.client_name ?? "—",
      kind: "cobrado",
      amount,
      paidAt: effectiveDateForProject(p),
    });
  }

  for (const p of needsPagado) {
    const paidAt = effectiveDateForProject(p);
    const totalCost = p.editors.reduce((sum, a) => {
      if (!a.editor) return sum;
      const c = editorCostInProject(p, a.editor.id);
      return sum + (c ?? 0);
    }, 0);
    items.push({
      id: p.id,
      code: p.project_code ?? "—",
      title: p.title,
      clientName: p.client?.name ?? p.client_name ?? "—",
      kind: "pagado",
      amount: totalCost > 0 ? totalCost : null,
      paidAt,
    });
  }

  items.sort((a, b) => a.paidAt.localeCompare(b.paidAt));

  return {
    items,
    cobroCount: needsCobro.length,
    pagadoCount: needsPagado.length,
  };
}

export async function runBackfill(): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { needsCobro, needsPagado } = await fetchAffectedProjects(supabase);

  let created = 0;

  // ── Cobros ────────────────────────────────────────────────────────────────
  for (const p of needsCobro) {
    const amount = computePrice(p);
    if (amount == null || amount === 0) continue;
    const paidAt = effectiveDateForProject(p);
    const { error } = await supabase.from("project_cobros").insert({
      project_id: p.id,
      amount,
      paid_at: paidAt,
      note: "backfill",
    });
    if (error) return { ok: false, error: `cobro ${p.project_code}: ${error.message}` };
    created++;
  }

  // ── Editor pagos ──────────────────────────────────────────────────────────
  for (const p of needsPagado) {
    const paidAt = effectiveDateForProject(p);
    for (const assignment of p.editors) {
      if (!assignment.editor) continue;
      const cost = editorCostInProject(p, assignment.editor.id);
      if (cost == null || cost === 0) continue;
      const { error } = await supabase.from("project_editor_pagos").insert({
        project_id: p.id,
        editor_id: assignment.editor.id,
        amount: cost,
        paid_at: paidAt,
        note: "backfill",
      });
      if (error) return { ok: false, error: `pagado ${p.project_code}: ${error.message}` };
      created++;
    }
  }

  // Invalidar cache
  revalidateTag(CACHE_TAGS.projects, {});
  revalidateTag(CACHE_TAGS.finanzas, {});

  return { ok: true, created };
}
