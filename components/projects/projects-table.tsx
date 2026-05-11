import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_CLASS,
  STATUS_LABEL,
  formatDate,
  formatPrice,
} from "@/lib/projects/format";
import type { ProjectWithEditor } from "@/lib/projects/types";

export function ProjectsTable({ projects }: { projects: ProjectWithEditor[] }) {
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">{p.title}</TableCell>
            <TableCell>{p.client?.name ?? p.client_name ?? "—"}</TableCell>
            <TableCell>
              <Badge variant="secondary" className={STATUS_CLASS[p.status]}>
                {STATUS_LABEL[p.status]}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatPrice(p.price, p.currency)}
            </TableCell>
            <TableCell>{p.editor?.name ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(p.updated_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
