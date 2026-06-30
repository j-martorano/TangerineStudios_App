"use client";

import { Fragment } from "react";

import { TableCell, TableRow } from "@/components/ui/table";

import { ProjectRow } from "./project-row";
import type { ParentOption } from "./project-form";
import type {
  ClientForProject,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";

const COL_HEADERS = [
  { label: "", className: "w-14" },
  { label: "Cliente", className: "w-32" },
  { label: "Fase", className: "w-36" },
  { label: "Código", className: "w-28" },
  { label: "Título", className: "" },
  { label: "Balance", className: "w-44" },
  { label: "Cobrado", className: "w-32" },
  { label: "Pagado", className: "w-32" },
  { label: "Facturado", className: "w-36" },
  { label: "Creación", className: "w-20" },
  { label: "Editores", className: "w-44" },
  { label: "", className: "w-10" },
] as const;

const COL_SPAN = COL_HEADERS.length;

type Props = {
  monthKey: string;
  monthLabel: string;
  items: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
  highlightId?: string;
};

export function MonthGroup({
  monthKey: _monthKey,
  monthLabel,
  items,
  editors,
  clients,
  availableParents = [],
  highlightId,
}: Props) {
  return (
    <Fragment>
      {/* Month title */}
      <TableRow
        style={{ backgroundColor: "#4C4C4C" }}
        className="border-0 hover:bg-transparent"
      >
        <TableCell colSpan={COL_SPAN} className="px-4 py-4">
          <span className="text-4xl font-bold uppercase tracking-tight leading-none">
            {monthLabel}
          </span>
        </TableCell>
      </TableRow>

      {/* Column headers */}
      <TableRow
        className="border-b border-white/[0.06] hover:bg-transparent"
        style={{ backgroundColor: "#0e0e0e" }}
      >
        {COL_HEADERS.map((col, i) => (
          <TableCell
            key={i}
            className={`${col.className} py-2 ${
              i === 0
                ? "px-4"
                : i === COL_HEADERS.length - 1
                  ? "pr-3 pl-2"
                  : "px-2"
            }`}
          >
            {col.label ? (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                {col.label}
              </span>
            ) : null}
          </TableCell>
        ))}
      </TableRow>

      {/* Data rows */}
      {items.map((p, idx) => (
        <ProjectRow
          key={p.id}
          project={p}
          editors={editors}
          clients={clients}
          availableParents={availableParents}
          rowIndex={idx}
          highlightId={highlightId}
        />
      ))}
    </Fragment>
  );
}
