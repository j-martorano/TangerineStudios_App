"use client";

import { Fragment, useState } from "react";
import { ChevronRightIcon } from "lucide-react";

import { TableCell, TableRow } from "@/components/ui/table";

import { ArchiveProjectButton } from "./archive-project-button";
import { EditProjectButton } from "./edit-project-button";
import { FinalizeToggle } from "./finalize-toggle";
import { QuickDurationEditor } from "./quick-duration-editor";
import { QuickPhaseBadge } from "./quick-phase-badge";
import { QuickPaymentBadge } from "./quick-payment-badge";

import {
  computeCost,
  computePrice,
  computeProfit,
  formatDate,
  formatPrice,
} from "@/lib/projects/format";
import { editorNames } from "@/lib/projects/types";
import type {
  ClientForProject,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";
import {
  PROJECTS_COLUMNS,
  PROJECTS_COLUMN_LABEL,
  type ProjectsColumnId,
} from "@/lib/settings/types";

type Props = {
  project: ProjectWithRelations;
  editors: EditorMini[];
  clients: ClientForProject[];
  visibleColumns: ProjectsColumnId[];
  /** Si false, no se renderiza la celda del chevron (no hay nada para expandir). */
  showExpand: boolean;
  rowClassName: string;
  rowStyle?: React.CSSProperties;
};

export function ProjectRow({
  project,
  editors,
  clients,
  visibleColumns,
  showExpand,
  rowClassName,
  rowStyle,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = new Set<ProjectsColumnId>(visibleColumns);
  const hidden = PROJECTS_COLUMNS.filter((c) => !visible.has(c));
  const locked = project.finalized;

  return (
    <Fragment>
      <TableRow className={rowClassName} style={rowStyle}>
        {showExpand ? (
          <TableCell className="w-8 p-1 align-middle">
            {hidden.length > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Colapsar fila" : "Expandir fila"}
                aria-expanded={expanded}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronRightIcon
                  className={`size-4 transition-transform duration-200 ${
                    expanded ? "rotate-90" : ""
                  }`}
                />
              </button>
            ) : null}
          </TableCell>
        ) : null}
        {visibleColumns.map((id) => (
          <TableCell key={id} className={cellClass(id)}>
            {renderValue(id, project, editors, clients, locked)}
          </TableCell>
        ))}
      </TableRow>
      {expanded && hidden.length > 0 ? (
        <TableRow className={rowClassName} style={rowStyle}>
          {showExpand ? <TableCell className="w-8 p-1" /> : null}
          <TableCell
            colSpan={visibleColumns.length}
            className="bg-muted/20 px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3 md:grid-cols-4">
              {hidden.map((id) => (
                <div key={id} className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {PROJECTS_COLUMN_LABEL[id]}
                  </span>
                  <div>
                    {renderValue(id, project, editors, clients, locked)}
                  </div>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </Fragment>
  );
}

function cellClass(id: ProjectsColumnId): string {
  switch (id) {
    case "code":
      return "font-mono text-xs text-muted-foreground";
    case "title":
      return "font-medium";
    case "price":
    case "profit":
      return "text-right tabular-nums";
    case "cost":
      return "text-right tabular-nums text-muted-foreground";
    case "duration":
      return "tabular-nums";
    case "updated":
      return "text-muted-foreground";
    case "actions":
      return "text-right";
    case "finalized":
      return "text-center";
    default:
      return "";
  }
}

function renderValue(
  id: ProjectsColumnId,
  p: ProjectWithRelations,
  editors: EditorMini[],
  clients: ClientForProject[],
  locked: boolean
): React.ReactNode {
  switch (id) {
    case "code":
      return p.project_code;
    case "title":
      return p.title;
    case "client":
      return p.client ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: p.client.color }}
          />
          {p.client.name}
        </span>
      ) : (
        (p.client_name ?? "—")
      );
    case "phase":
      return <QuickPhaseBadge id={p.id} phase={p.phase} disabled={locked} />;
    case "price":
      if (p.client?.payment_type === "mensual") return "RETAINER";
      const price = computePrice(p);
      return price != null ? formatPrice(price) : "—";
    case "cost": {
      const c = computeCost(p);
      return c != null ? formatPrice(c) : "—";
    }
    case "profit": {
      const profit = computeProfit(p);
      if (profit == null) return "—";
      return (
        <span className={profit < 0 ? "text-destructive" : ""}>
          {formatPrice(profit)}
        </span>
      );
    }
    case "duration":
      return (
        <QuickDurationEditor
          id={p.id}
          value={p.duration_minutes}
          disabled={locked}
        />
      );
    case "editor":
      return editorNames(p);
    case "cobrado":
      return (
        <QuickPaymentBadge
          kind="cobrado"
          id={p.id}
          value={p.cobrado}
          disabled={locked}
        />
      );
    case "pagado":
      return (
        <QuickPaymentBadge
          kind="pagado"
          id={p.id}
          value={p.pagado}
          disabled={locked}
        />
      );
    case "invoiced":
      return (
        <QuickPaymentBadge
          kind="invoiced"
          id={p.id}
          value={p.invoiced}
          disabled={locked}
        />
      );
    case "updated":
      return formatDate(p.updated_at);
    case "actions":
      return (
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
      );
    case "finalized":
      return (
        <div className="flex justify-center">
          <FinalizeToggle
            id={p.id}
            title={p.title}
            finalized={p.finalized}
          />
        </div>
      );
  }
}
