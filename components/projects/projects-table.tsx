"use client";

import { Fragment, useState } from "react";
import { currentMonthKeyAR } from "@/lib/argentina-date";

import { PlusIcon } from "lucide-react";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { MonthGroup } from "./month-group";
import { ProjectForm, type ParentOption } from "./project-form";

import type {
  ClientForProject,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";

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

function effectiveDate(p: ProjectWithRelations): string | null | undefined {
  return p.phase === "terminado" && p.finalized_at ? p.finalized_at : p.created_at;
}

function groupByMonth(
  projects: ProjectWithRelations[]
): [string, ProjectWithRelations[]][] {
  const topLevel = projects.filter((p) => !p.parent_id);
  const map = new Map<string, ProjectWithRelations[]>();
  for (const p of topLevel) {
    const key = monthKey(effectiveDate(p));
    const arr = map.get(key);
    if (arr) arr.push(p);
    else map.set(key, [p]);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

const COL_SPAN = 12;

type Props = {
  projects: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
  highlightId?: string;
};

export function ProjectsTable({
  projects,
  editors,
  clients,
  availableParents = [],
  highlightId,
}: Props) {
  const currentMK = currentMonthKeyAR();
  const baseGroups = groupByMonth(projects);

  // Siempre incluir el mes actual como primer grupo aunque esté vacío
  const groups: [string, ProjectWithRelations[]][] =
    baseGroups.length > 0 && baseGroups[0][0] === currentMK
      ? baseGroups
      : [[currentMK, []], ...baseGroups];

  return (
    <Table>
      <TableBody>
        {groups.map(([key, items], idx) => (
          <Fragment key={key}>
            <MonthGroup
              monthKey={key}
              monthLabel={monthLabel(key)}
              items={items}
              editors={editors}
              clients={clients}
              availableParents={availableParents}
              highlightId={highlightId}
            />
            {/* Fila "nuevo proyecto" debajo del mes actual */}
            {idx === 0 && (
              <AddProjectRow
                editors={editors}
                clients={clients}
                availableParents={availableParents}
              />
            )}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Inline "add project" row ───────────────────────────────────────────────

function AddProjectRow({
  editors,
  clients,
  availableParents,
}: {
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents: ParentOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        className="cursor-pointer border-t border-white/[0.04] hover:bg-white/[0.03]"
        style={{ backgroundColor: "#111111" }}
        onClick={() => setOpen(true)}
      >
        <TableCell colSpan={COL_SPAN} className="px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground/40 transition-colors hover:text-muted-foreground/70">
            <PlusIcon className="size-4" />
            Nuevo proyecto
          </span>
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
            <DialogDescription>
              Cargá los datos. Si el cliente no está en la lista, lo creás desde
              el combobox.
            </DialogDescription>
          </DialogHeader>
          <ProjectForm
            mode="create"
            editors={editors}
            clients={clients}
            availableParents={availableParents}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
