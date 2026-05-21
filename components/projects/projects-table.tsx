import { Fragment } from "react";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { MonthGroup } from "./month-group";
import type { ParentOption } from "./project-form";

import type {
  ClientForProject,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";
import {
  PROJECTS_COLUMNS,
  type ProjectsColumnId,
} from "@/lib/settings/types";

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

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function groupByMonth(
  projects: ProjectWithRelations[]
): [string, ProjectWithRelations[]][] {
  // Solo proyectos top-level (sin parent). Los shorts hijos se renderizan
  // dentro de su pack cuando se despliega.
  const topLevel = projects.filter((p) => !p.parent_id);
  const map = new Map<string, ProjectWithRelations[]>();
  for (const p of topLevel) {
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
  availableParents?: ParentOption[];
};

export function ProjectsTable({
  projects,
  editors,
  clients,
  visibleColumns,
  availableParents = [],
}: Props) {
  if (projects.length === 0) {
    return (
      <p className="px-2 py-6 text-sm text-muted-foreground italic">
        No hay proyectos cargados todavía.
      </p>
    );
  }

  const showExpand = visibleColumns.length < PROJECTS_COLUMNS.length;
  const colSpan = visibleColumns.length + (showExpand ? 1 : 0);
  const groups = groupByMonth(projects);
  const currentKey = currentMonthKey();

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
        {groups.map(([key, items]) => (
          <MonthGroup
            key={key}
            monthKey={key}
            monthLabel={monthLabel(key)}
            items={items}
            editors={editors}
            clients={clients}
            availableParents={availableParents}
            visibleColumns={visibleColumns}
            showExpand={showExpand}
            colSpan={colSpan}
            defaultOpen={key === currentKey}
          />
        ))}
      </TableBody>
    </Table>
  );
}
