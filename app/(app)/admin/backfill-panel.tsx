"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { runBackfill } from "@/lib/projects/backfill";
import type { BackfillPreview } from "@/lib/projects/backfill";
import { formatPrice } from "@/lib/projects/format";

export function BackfillPanel({ preview }: { preview: BackfillPreview }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function handleRun() {
    start(async () => {
      const result = await runBackfill();
      if (result.ok) {
        toast.success(`Backfill completado — ${result.created} registro${result.created === 1 ? "" : "s"} creado${result.created === 1 ? "" : "s"}`);
        setDone(true);
      } else {
        toast.error(`Error: ${result.error}`);
      }
    });
  }

  const hasItems = preview.items.length > 0;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Backfill de fechas de cobro/pago</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea registros en <code className="rounded bg-white/8 px-1 py-0.5 text-xs">project_cobros</code> y{" "}
            <code className="rounded bg-white/8 px-1 py-0.5 text-xs">project_editor_pagos</code> para proyectos
            que fueron marcados con el sistema anterior y no tienen fechas asignadas.
          </p>
          <p className="mt-1.5 text-xs text-amber-400">
            ⚠ No modifica <code className="rounded bg-white/8 px-1 py-0.5">position</code>,{" "}
            <code className="rounded bg-white/8 px-1 py-0.5">phase</code> ni{" "}
            <code className="rounded bg-white/8 px-1 py-0.5">finalized_at</code>. El orden del kanban no cambia.
          </p>
        </div>

        {!done && (
          <button
            type="button"
            onClick={handleRun}
            disabled={pending || !hasItems}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Ejecutando…" : "Ejecutar backfill"}
          </button>
        )}

        {done && (
          <span className="shrink-0 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400">
            ✓ Completado
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span className="rounded-md bg-sky-500/10 px-3 py-1.5 text-sky-400">
          {preview.cobroCount} cobrado{preview.cobroCount === 1 ? "" : "s"} sin registro
        </span>
        <span className="rounded-md bg-red-500/10 px-3 py-1.5 text-red-400">
          {preview.pagadoCount} pagado{preview.pagadoCount === 1 ? "" : "s"} sin registro
        </span>
      </div>

      {/* Preview table */}
      {hasItems ? (
        <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 bg-black/20 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Proyecto</th>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2 text-right">Monto</th>
                <th className="px-4 py-2 text-right">Fecha asignada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {preview.items.map((item, i) => (
                <tr key={`${item.id}-${item.kind}`} className={i % 2 === 1 ? "bg-white/[0.02]" : ""}>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{item.code}</td>
                  <td className="px-4 py-2 font-medium">{item.title}</td>
                  <td className="px-4 py-2 text-muted-foreground">{item.clientName}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      item.kind === "cobrado"
                        ? "bg-sky-500/15 text-sky-400"
                        : "bg-red-500/15 text-red-400"
                    }`}>
                      {item.kind === "cobrado" ? "Cobro" : "Pago"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {item.amount != null ? formatPrice(item.amount) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {item.paidAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          ✓ Todos los proyectos ya tienen sus registros de fecha. No hay nada que migrar.
        </p>
      )}
    </section>
  );
}
