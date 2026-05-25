"use client";

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";

import { CobroManagerPanel } from "@/components/projects/cobro-manager";
import { PagoManagerPanel } from "@/components/projects/pago-manager";
import { ProjectSettleButton } from "@/components/finanzas/project-settle-button";
import { formatPrice } from "@/lib/projects/format";
import type { ProjectWithRelations } from "@/lib/projects/types";

export type SettleRowItem = {
  yearMonth: string;
  monthLabel: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  clientName: string;
  field: "cobrado" | "pagado";
  total: number | null;
  progress: number;
  remaining: number | null;
  settled: boolean;
  project: ProjectWithRelations;
};

/**
 * Fila de la pestaña «Por proyecto» en Finanzas. Muestra el resumen
 * (proyecto, cliente, mes, progreso) + chevron que despliega el panel del
 * `CobroManager` o `PagoManager` para registrar parciales sin tener que ir
 * a la tabla de Proyectos.
 */
export function SettleRow({ item }: { item: SettleRowItem }) {
  const [open, setOpen] = useState(false);
  const pct =
    item.total != null && item.total > 0
      ? Math.min(100, Math.round((item.progress / item.total) * 100))
      : item.settled
        ? 100
        : 0;

  return (
    <div className="flex flex-col">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
          item.settled ? "opacity-60" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Colapsar" : "Expandir"}
          aria-expanded={open}
          className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronRightIcon
            className={`size-4 transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
          />
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {item.projectCode}
          </span>
          <span className="truncate text-sm font-medium">
            {item.projectTitle}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {item.clientName} · {item.monthLabel}
          </span>
          {item.total != null && item.total > 0 ? (
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${
                    item.settled ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {pct}%
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-1">
          {item.settled ? (
            <span className="text-sm font-semibold tabular-nums text-emerald-500">
              {item.total != null ? formatPrice(item.total) : "—"}
            </span>
          ) : (
            <>
              <span className="text-sm font-semibold tabular-nums text-amber-500">
                {item.remaining != null
                  ? formatPrice(item.remaining)
                  : "—"}{" "}
                falta
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {formatPrice(item.progress)} de{" "}
                {item.total != null ? formatPrice(item.total) : "—"}
              </span>
            </>
          )}
          <ProjectSettleButton
            projectId={item.projectId}
            field={item.field}
            settled={item.settled}
            description={`${item.projectCode} (${item.field})`}
          />
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-muted/50 px-4 py-3 border-l-2 border-l-border/60 animate-in fade-in slide-in-from-top-1 duration-200">
          {item.field === "cobrado" ? (
            <CobroManagerPanel project={item.project} />
          ) : (
            <PagoManagerPanel project={item.project} />
          )}
        </div>
      ) : null}
    </div>
  );
}
