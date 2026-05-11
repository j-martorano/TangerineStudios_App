import { ExternalLinkIcon } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { EditEditorButton } from "./edit-editor-button";
import { DeleteEditorButton } from "./delete-editor-button";
import type { EditorWithCount } from "@/lib/projects/queries";
import type { ClientMini } from "@/lib/projects/types";
import { formatDate } from "@/lib/projects/format";

export function EditorsTable({
  editors,
  availableClients,
}: {
  editors: EditorWithCount[];
  availableClients: ClientMini[];
}) {
  if (editors.length === 0) {
    return (
      <p className="px-2 py-6 text-sm text-muted-foreground italic">
        No hay editores cargados todavía. Creá uno con «Nuevo editor».
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Clientes</TableHead>
          <TableHead>Contacto</TableHead>
          <TableHead>Discord</TableHead>
          <TableHead>Banco</TableHead>
          <TableHead>Docs</TableHead>
          <TableHead className="text-right">Proyectos</TableHead>
          <TableHead className="w-24 text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {editors.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="font-medium">{e.name}</TableCell>
            <TableCell>
              {e.clients.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {e.clients.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="max-w-[18ch] truncate text-muted-foreground">
              {e.email ?? e.phone ?? "—"}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {e.discord_id ?? "—"}
            </TableCell>
            <TableCell className="max-w-[20ch] truncate text-muted-foreground">
              {e.bank_info ?? "—"}
            </TableCell>
            <TableCell>
              {e.docs_url ? (
                <a
                  href={e.docs_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Ver
                  <ExternalLinkIcon className="size-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {e.project_count}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <EditEditorButton
                  editor={e}
                  availableClients={availableClients}
                />
                <DeleteEditorButton
                  id={e.id}
                  name={e.name}
                  projectCount={e.project_count}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
