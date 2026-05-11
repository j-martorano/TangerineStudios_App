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
import { QuickStatusBadge } from "./quick-status-badge";

import { formatDate, formatPrice } from "@/lib/projects/format";
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
          <TableHead>Título</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Precio</TableHead>
          <TableHead>Editor</TableHead>
          <TableHead>Actualizado</TableHead>
          <TableHead className="w-24 text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">{p.title}</TableCell>
            <TableCell>{p.client?.name ?? p.client_name ?? "—"}</TableCell>
            <TableCell>
              <QuickStatusBadge id={p.id} status={p.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatPrice(p.price, p.currency)}
            </TableCell>
            <TableCell>{p.editor?.name ?? "—"}</TableCell>
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
