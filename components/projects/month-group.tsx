"use client";

import { Fragment, useState } from "react";
import { ChevronDownIcon, FolderIcon } from "lucide-react";

import { TableCell, TableRow } from "@/components/ui/table";

import { ProjectRow } from "./project-row";
import type { ParentOption } from "./project-form";
import { monthToneFromKey } from "@/lib/projects/month-colors";
import type {
  ClientForProject,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";
import type { ProjectsColumnId } from "@/lib/settings/types";

// Tinte de fondo de fila con el color del cliente (~20% de opacidad).
function clientTint(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  return `${hex}33`;
}

function rowAppearance(p: ProjectWithRelations): {
  className: string;
  style?: React.CSSProperties;
} {
  if (p.archived) return { className: "bg-muted/60 opacity-55" };
  if (p.finalized) return { className: "bg-muted/40" };
  return {
    style: { backgroundColor: clientTint(p.client?.color) },
    className: "",
  };
}

type Props = {
  monthKey: string;
  monthLabel: string;
  items: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
  visibleColumns: ProjectsColumnId[];
  showExpand: boolean;
  colSpan: number;
  defaultOpen: boolean;
};

/**
 * Grupo plegable de un mes en la tabla de Proyectos. La etiqueta del mes
 * (estilo pestaña de carpeta) actúa como botón: el chevron rota y los rows
 * aparecen/desaparecen con una animación corta.
 */
export function MonthGroup({
  monthKey,
  monthLabel,
  items,
  editors,
  clients,
  availableParents = [],
  visibleColumns,
  showExpand,
  colSpan,
  defaultOpen,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = monthToneFromKey(monthKey);

  return (
    <Fragment>
      <TableRow className="border-0 hover:bg-transparent">
        <TableCell colSpan={colSpan} className="p-0 pt-5 pb-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex cursor-pointer items-center gap-2 rounded-t-lg rounded-br-lg border-b-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all hover:brightness-110"
            style={{
              backgroundColor: tone.tint,
              borderColor: tone.accent,
              color: tone.solid,
            }}
          >
            <ChevronDownIcon
              className={`size-3.5 transition-transform duration-200 ${
                open ? "" : "-rotate-90"
              }`}
            />
            <FolderIcon className="size-3.5" />
            {monthLabel}
            <span className="font-normal opacity-70">· {items.length}</span>
          </button>
        </TableCell>
      </TableRow>
      {open
        ? items.map((p) => {
            const appearance = rowAppearance(p);
            return (
              <ProjectRow
                key={p.id}
                project={p}
                editors={editors}
                clients={clients}
                availableParents={availableParents}
                visibleColumns={visibleColumns}
                showExpand={showExpand}
                rowClassName={`${appearance.className} animate-in fade-in slide-in-from-top-1 duration-200`}
                rowStyle={appearance.style}
              />
            );
          })
        : null}
    </Fragment>
  );
}
