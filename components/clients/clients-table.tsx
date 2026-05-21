import { ExternalLinkIcon } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { EditClientButton } from "./edit-client-button";
import { DeleteClientButton } from "./delete-client-button";
import type { ClientWithCount } from "@/lib/projects/queries";
import type { EditorMini } from "@/lib/projects/types";
import { PAYMENT_TYPE_LABEL } from "@/lib/projects/types";
import type { ClientsColumnId } from "@/lib/settings/types";

type Props = {
  clients: ClientWithCount[];
  availableEditors: EditorMini[];
  visibleColumns: ClientsColumnId[];
};

export function ClientsTable({
  clients,
  availableEditors,
  visibleColumns,
}: Props) {
  if (clients.length === 0) {
    return (
      <p className="px-2 py-6 text-sm text-muted-foreground italic">
        No hay clientes cargados todavía. Creá uno con «Nuevo cliente».
      </p>
    );
  }

  const visible = new Set<ClientsColumnId>(visibleColumns);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {visible.has("color") && <TableHead className="w-10"></TableHead>}
          {visible.has("name") && <TableHead>Nombre</TableHead>}
          {visible.has("type") && <TableHead>Tipo</TableHead>}
          {visible.has("minute_balance") && (
            <TableHead className="text-right">Saldo minutos</TableHead>
          )}
          {visible.has("editors") && <TableHead>Editores</TableHead>}
          {visible.has("contact") && <TableHead>Contacto</TableHead>}
          {visible.has("docs") && <TableHead>Docs</TableHead>}
          {visible.has("projects") && (
            <TableHead className="text-right">Proyectos</TableHead>
          )}
          {visible.has("actions") && (
            <TableHead className="w-24 text-right">Acciones</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((c) => (
          <TableRow key={c.id}>
            {visible.has("color") && (
              <TableCell>
                <span
                  className="inline-block size-4 rounded-full ring-1 ring-foreground/20"
                  style={{ backgroundColor: c.color }}
                  title={c.color}
                />
              </TableCell>
            )}
            {visible.has("name") && (
              <TableCell className="font-medium">{c.name}</TableCell>
            )}
            {visible.has("type") && (
              <TableCell>
                <Badge variant="outline">
                  {PAYMENT_TYPE_LABEL[c.payment_type]}
                </Badge>
              </TableCell>
            )}
            {visible.has("minute_balance") && (
              <TableCell className="text-right tabular-nums">
                {c.payment_type === "mensual" && c.minute_balance != null ? (
                  <span
                    className={c.minute_balance < 0 ? "text-destructive" : ""}
                  >
                    {formatMinutes(c.minute_balance)}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
            )}
            {visible.has("editors") && (
              <TableCell>
                {c.editors.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {c.editors.map((e) => (
                      <span
                        key={e.id}
                        className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {e.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            )}
            {visible.has("contact") && (
              <TableCell className="max-w-[18ch] truncate text-muted-foreground">
                {c.email ?? c.phone ?? "—"}
              </TableCell>
            )}
            {visible.has("docs") && (
              <TableCell>
                {c.docs_url ? (
                  <a
                    href={c.docs_url}
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
            )}
            {visible.has("projects") && (
              <TableCell className="text-right tabular-nums">
                {c.project_count}
              </TableCell>
            )}
            {visible.has("actions") && (
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <EditClientButton
                    client={c}
                    availableEditors={availableEditors}
                  />
                  <DeleteClientButton
                    id={c.id}
                    name={c.name}
                    projectCount={c.project_count}
                  />
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatMinutes(value: number): string {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return `${rounded} min`;
}
