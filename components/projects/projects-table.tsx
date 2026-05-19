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

import { ArchiveProjectButton } from "./archive-project-button";
import { EditProjectButton } from "./edit-project-button";
import { FinalizeToggle } from "./finalize-toggle";
import { QuickPhaseBadge } from "./quick-phase-badge";
import { QuickPaymentBadge } from "./quick-payment-badge";

import {
  computeCost,
  computePrice,
  computeProfit,
  formatDate,
  formatDuration,
  formatPrice,
} from "@/lib/projects/format";
import { monthToneFromKey } from "@/lib/projects/month-colors";
import {
  getPrimaryEditor,
  getSecondaryEditor,
} from "@/lib/projects/types";
import type {
  ClientMini,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";

const COLSPAN = 15;

// Tinte de fondo de fila con el color del cliente (~12% de opacidad).
function clientTint(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  return `${hex}1f`; // hex de 8 dígitos: #RRGGBB + alpha 0x1f
}

// Estilo de la fila según el estado del proyecto:
//   - archivado  : gris apagado (deshabilitado)
//   - finalizado : gris
//   - activo     : tinte con el color del cliente
function rowAppearance(p: ProjectWithRelations): {
  className: string;
  style?: React.CSSProperties;
} {
  if (p.archived) return { className: "bg-muted/60 opacity-55" };
  if (p.finalized) return { className: "bg-muted/40" };
  return { style: { backgroundColor: clientTint(p.client?.color) }, className: "" };
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

// Clave "YYYY-MM" a partir del created_at del proyecto.
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

// Agrupa los proyectos por mes y devuelve los grupos del más reciente al más
// viejo.
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

type Props = {
  projects: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientMini[];
};

export function ProjectsTable({ projects, editors, clients }: Props) {
  if (projects.length === 0) {
    return (
      <p className="px-2 py-6 text-sm text-muted-foreground italic">
        No hay proyectos cargados todavía.
      </p>
    );
  }

  const groups = groupByMonth(projects);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-32">Código</TableHead>
          <TableHead>Título</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Fase</TableHead>
          <TableHead className="text-right">Precio</TableHead>
          <TableHead className="text-right">Costo</TableHead>
          <TableHead className="text-right">Ganancia</TableHead>
          <TableHead>Duración</TableHead>
          <TableHead>Editor</TableHead>
          <TableHead>Cobrado</TableHead>
          <TableHead>Pagado</TableHead>
          <TableHead>Facturado</TableHead>
          <TableHead>Actualizado</TableHead>
          <TableHead className="w-24 text-right">Acciones</TableHead>
          <TableHead className="w-24 text-center">Finalizado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map(([key, items]) => {
          const tone = monthToneFromKey(key);
          return (
            <Fragment key={key}>
              {/* Etiqueta de mes — estilo pestaña de carpeta de informes. */}
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={COLSPAN} className="p-0 pt-5 pb-1">
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
                const locked = p.finalized;
                const appearance = rowAppearance(p);
                return (
                  <TableRow
                    key={p.id}
                    className={appearance.className}
                    style={appearance.style}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.project_code}
                    </TableCell>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>
                      {p.client ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: p.client.color }}
                          />
                          {p.client.name}
                        </span>
                      ) : (
                        p.client_name ?? "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <QuickPhaseBadge
                        id={p.id}
                        phase={p.phase}
                        disabled={locked}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.client?.payment_type === "mensual"
                        ? "Mensual"
                        : (() => {
                            const price = computePrice(p);
                            return price != null ? formatPrice(price) : "—";
                          })()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {(() => {
                        const c = computeCost(p);
                        return c != null ? formatPrice(c) : "—";
                      })()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(() => {
                        const profit = computeProfit(p);
                        if (profit == null) return "—";
                        return (
                          <span
                            className={profit < 0 ? "text-destructive" : ""}
                          >
                            {formatPrice(profit)}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDuration(p.duration_minutes)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const primary = getPrimaryEditor(p);
                        const secondary = getSecondaryEditor(p);
                        if (!primary && !secondary) return "—";
                        const names = [
                          primary?.editor?.name,
                          secondary?.editor?.name,
                        ]
                          .filter(Boolean)
                          .join(" + ");
                        return names || "—";
                      })()}
                    </TableCell>
                    <TableCell>
                      <QuickPaymentBadge
                        kind="cobrado"
                        id={p.id}
                        value={p.cobrado}
                        disabled={locked}
                      />
                    </TableCell>
                    <TableCell>
                      <QuickPaymentBadge
                        kind="pagado"
                        id={p.id}
                        value={p.pagado}
                        disabled={locked}
                      />
                    </TableCell>
                    <TableCell>
                      <QuickPaymentBadge
                        kind="invoiced"
                        id={p.id}
                        value={p.invoiced}
                        disabled={locked}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(p.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditProjectButton
                          project={p}
                          editors={editors}
                          clients={clients}
                          disabled={locked}
                        />
                        <ArchiveProjectButton
                          id={p.id}
                          title={p.title}
                          archived={p.archived}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <FinalizeToggle
                          id={p.id}
                          title={p.title}
                          finalized={p.finalized}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
