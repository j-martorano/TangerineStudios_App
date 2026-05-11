import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { EditClientButton } from "./edit-client-button";
import { DeleteClientButton } from "./delete-client-button";
import type { ClientWithCount } from "@/lib/projects/queries";
import { formatDate } from "@/lib/projects/format";

export function ClientsTable({ clients }: { clients: ClientWithCount[] }) {
  if (clients.length === 0) {
    return (
      <p className="px-2 py-6 text-sm text-muted-foreground italic">
        No hay clientes cargados todavía. Creá uno con «Nuevo cliente».
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead className="text-right">Proyectos</TableHead>
          <TableHead>Alta</TableHead>
          <TableHead className="w-24 text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell className="text-right tabular-nums">
              {c.project_count}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(c.created_at)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <EditClientButton client={{ id: c.id, name: c.name }} />
                <DeleteClientButton
                  id={c.id}
                  name={c.name}
                  projectCount={c.project_count}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
