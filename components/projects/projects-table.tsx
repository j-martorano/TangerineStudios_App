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
import { editorNames } from "@/lib/projects/types";
import type {
  ClientForProject,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";
import type { ProjectsColumnId } from "@/lib/settings/types";

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

  const visible = new Set<ProjectsColumnId>(visibleColumns);
  const colSpan = Math.max(1, visibleColumns.length);
  const groups = groupByMonth(projects);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {visible.has("code") && <TableHead className="w-32">Código</TableHead>}
          {visible.has("title") && <TableHead>Título</TableHead>}
          {visible.has("client") && <TableHead>Cliente</TableHead>}
          {visible.has("phase") && <TableHead>Fase</TableHead>}
          {visible.has("price") && (
            <TableHead className="text-right">Precio</TableHead>
          )}
          {visible.has("cost") && (
            <TableHead className="text-right">Costo</TableHead>
          )}
          {visible.has("profit") && (
            <TableHead className="text-right">Ganancia</TableHead>
          )}
          {visible.has("duration") && <TableHead>Duración</TableHead>}
          {visible.has("editor") && <TableHead>Editor</TableHead>}
          {visible.has("cobrado") && <TableHead>Cobrado</TableHead>}
          {visible.has("pagado") && <TableHead>Pagado</TableHead>}
          {visible.has("invoiced") && <TableHead>Facturado</TableHead>}
          {visible.has("updated") && <TableHead>Actualizado</TableHead>}
          {visible.has("actions") && (
            <TableHead className="w-24 text-right">Acciones</TableHead>
          )}
          {visible.has("finalized") && (
            <TableHead className="w-24 text-center">Finalizado</TableHead>
          )}
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
                const locked = p.finalized;
                const appearance = rowAppearance(p);
                return (
                  <TableRow
                    key={p.id}
                    className={appearance.className}
                    style={appearance.style}
                  >
                    {visible.has("code") && (
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {p.project_code}
                      </TableCell>
                    )}
                    {visible.has("title") && (
                      <TableCell className="font-medium">{p.title}</TableCell>
                    )}
                    {visible.has("client") && (
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
                          (p.client_name ?? "—")
                        )}
                      </TableCell>
                    )}
                    {visible.has("phase") && (
                      <TableCell>
                        <QuickPhaseBadge
                          id={p.id}
                          phase={p.phase}
                          disabled={locked}
                        />
                      </TableCell>
                    )}
                    {visible.has("price") && (
                      <TableCell className="text-right tabular-nums">
                        {p.client?.payment_type === "mensual"
                          ? "Mensual"
                          : (() => {
                              const price = computePrice(p);
                              return price != null
                                ? formatPrice(price)
                                : "—";
                            })()}
                      </TableCell>
                    )}
                    {visible.has("cost") && (
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {(() => {
                          const c = computeCost(p);
                          return c != null ? formatPrice(c) : "—";
                        })()}
                      </TableCell>
                    )}
                    {visible.has("profit") && (
                      <TableCell className="text-right tabular-nums">
                        {(() => {
                          const profit = computeProfit(p);
                          if (profit == null) return "—";
                          return (
                            <span
                              className={
                                profit < 0 ? "text-destructive" : ""
                              }
                            >
                              {formatPrice(profit)}
                            </span>
                          );
                        })()}
                      </TableCell>
                    )}
                    {visible.has("duration") && (
                      <TableCell className="tabular-nums">
                        {formatDuration(p.duration_minutes)}
                      </TableCell>
                    )}
                    {visible.has("editor") && (
                      <TableCell>{editorNames(p)}</TableCell>
                    )}
                    {visible.has("cobrado") && (
                      <TableCell>
                        <QuickPaymentBadge
                          kind="cobrado"
                          id={p.id}
                          value={p.cobrado}
                          disabled={locked}
                        />
                      </TableCell>
                    )}
                    {visible.has("pagado") && (
                      <TableCell>
                        <QuickPaymentBadge
                          kind="pagado"
                          id={p.id}
                          value={p.pagado}
                          disabled={locked}
                        />
                      </TableCell>
                    )}
                    {visible.has("invoiced") && (
                      <TableCell>
                        <QuickPaymentBadge
                          kind="invoiced"
                          id={p.id}
                          value={p.invoiced}
                          disabled={locked}
                        />
                      </TableCell>
                    )}
                    {visible.has("updated") && (
                      <TableCell className="text-muted-foreground">
                        {formatDate(p.updated_at)}
                      </TableCell>
                    )}
                    {visible.has("actions") && (
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
                    )}
                    {visible.has("finalized") && (
                      <TableCell>
                        <div className="flex justify-center">
                          <FinalizeToggle
                            id={p.id}
                            title={p.title}
                            finalized={p.finalized}
                          />
                        </div>
                      </TableCell>
                    )}
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
