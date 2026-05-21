import { Fragment } from "react";
import { FolderIcon } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ProjectRow } from "./project-row";

import { monthToneFromKey } from "@/lib/projects/month-colors";
import type {
  ClientForProject,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";
import {
  PROJECTS_COLUMNS,
  type ProjectsColumnId,
} from "@/lib/settings/types";

// Tinte de fondo de fila con el color del cliente (~12% de opacidad).
function clientTint(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  return `${hex}1f`; // hex de 8 dígitos: #RRGGBB + alpha 0x1f
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

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function monthKey(iso: string | null | undefined): string {
  if (!iso) return "0000-00";
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const idx = Number(month) - 1;
  const name = MONTH_NAMES[idx] ?? "Sin fecha";
  return year === "0000" ? "Sin fecha" : `${name} ${year}`;
}

function groupByMonth(
  projects: ProjectWithRelations[]
): [string, ProjectWithRelations[]][] {
  const map = new Map<string, ProjectWithRelations[]>();
  for (const p of projects) {
    const key = monthKey(p.created_at);
    const arr = map.get(key);
    if (arr) arr.push(p);
    else map.set(key, [p]);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function columnHeader(id: ProjectsColumnId): React.ReactNode {
  switch (id) {
    case "code":
      return <TableHead className="w-32">Código</TableHead>;
    case "title":
      return <TableHead>Título</TableHead>;
    case "client":
      return <TableHead>Cliente</TableHead>;
    case "phase":
      return <TableHead>Fase</TableHead>;
    case "price":
      return <TableHead className="text-right">Precio</TableHead>;
    case "cost":
      return <TableHead className="text-right">Costo</TableHead>;
    case "profit":
      return <TableHead className="text-right">Ganancia</TableHead>;
    case "duration":
      return <TableHead>Duración</TableHead>;
    case "editor":
      return <TableHead>Editor</TableHead>;
    case "cobrado":
      return <TableHead>Cobrado</TableHead>;
    case "pagado":
      return <TableHead>Pagado</TableHead>;
    case "invoiced":
      return <TableHead>Facturado</TableHead>;
    case "updated":
      return <TableHead>Actualizado</TableHead>;
    case "actions":
      return <TableHead className="w-24 text-right">Acciones</TableHead>;
    case "finalized":
      return <TableHead className="w-24 text-center">Finalizado</TableHead>;
  }
}

type Props = {
  projects: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  visibleColumns: ProjectsColumnId[];
};

export function ProjectsTable({
  projects,
  editors,
  clients,
  visibleColumns,
}: Props) {
  if (projects.length === 0) {
    return (
      <p className="px-2 py-6 text-sm text-muted-foreground italic">
        No hay proyectos cargados todavía.
      </p>
    );
  }

  // Mostramos la columna del chevron sólo si hay columnas ocultas para expandir.
  const showExpand = visibleColumns.length < PROJECTS_COLUMNS.length;
  const colSpan = visibleColumns.length + (showExpand ? 1 : 0);
  const groups = groupByMonth(projects);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showExpand ? <TableHead className="w-8" /> : null}
          {visibleColumns.map((id) => (
            <Fragment key={id}>{columnHeader(id)}</Fragment>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map(([key, items]) => {
          const tone = monthToneFromKey(key);
          return (
            <Fragment key={key}>
              {/* Etiqueta de mes — estilo pestaña de carpeta de informes. */}
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={colSpan} className="p-0 pt-5 pb-1">
                  <span
                    className="inline-flex items-center gap-2 rounded-t-lg rounded-br-lg border-b-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: tone.tint,
                      borderColor: tone.accent,
                      color: tone.solid,
                    }}
                  >
                    <FolderIcon className="size-3.5" />
                    {monthLabel(key)}
                    <span className="font-normal opacity-70">
                      · {items.length}
                    </span>
                  </span>
                </TableCell>
              </TableRow>
              {items.map((p) => {
                const appearance = rowAppearance(p);
                return (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    editors={editors}
                    clients={clients}
                    visibleColumns={visibleColumns}
                    showExpand={showExpand}
                    rowClassName={appearance.className}
                    rowStyle={appearance.style}
                  />
                );
              })}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
