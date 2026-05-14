import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DeleteProjectButton } from "./delete-project-button";
import { EditProjectButton } from "./edit-project-button";
import { QuickPhaseBadge } from "./quick-phase-badge";
import { QuickPaymentBadge } from "./quick-payment-badge";

import {
  computePrice,
  computeProfit,
  formatDate,
  formatDuration,
  formatPrice,
} from "@/lib/projects/format";
import {
  getPrimaryEditor,
  getSecondaryEditor,
} from "@/lib/projects/types";
import type {
  ClientMini,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";

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
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {p.project_code}
            </TableCell>
            <TableCell className="font-medium">{p.title}</TableCell>
            <TableCell>{p.client?.name ?? p.client_name ?? "—"}</TableCell>
            <TableCell>
              <QuickPhaseBadge id={p.id} phase={p.phase} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {p.client?.payment_type === "mensual"
                ? "Mensual"
                : (() => {
                    const price = computePrice(p);
                    return price != null ? formatPrice(price, p.currency) : "—";
                  })()}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {formatPrice(p.cost, p.currency)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {(() => {
                const profit = computeProfit(p);
                if (profit == null) return "—";
                return (
                  <span className={profit < 0 ? "text-destructive" : ""}>
                    {formatPrice(profit, p.currency)}
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
                const names = [primary?.editor?.name, secondary?.editor?.name]
                  .filter(Boolean)
                  .join(" + ");
                return names || "—";
              })()}
            </TableCell>
            <TableCell>
              <QuickPaymentBadge kind="cobrado" id={p.id} value={p.cobrado} />
            </TableCell>
            <TableCell>
              <QuickPaymentBadge kind="pagado" id={p.id} value={p.pagado} />
            </TableCell>
            <TableCell>
              <QuickPaymentBadge kind="invoiced" id={p.id} value={p.invoiced} />
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
                />
                <DeleteProjectButton id={p.id} title={p.title} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
