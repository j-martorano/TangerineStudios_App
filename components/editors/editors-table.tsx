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
import { ToggleDisabledButton } from "./toggle-disabled-button";
import { PaymentMethodChips } from "./payment-method-chips";
import { DiscordLinkCell } from "./discord-link-cell";
import type { EditorWithCount } from "@/lib/projects/queries";
import type { ClientMini, ContactLink } from "@/lib/projects/types";
import type { PaymentMethod } from "@/lib/payment-methods/queries";
import type { EditorsColumnId } from "@/lib/settings/types";

type Props = {
  editors: EditorWithCount[];
  availableClients: ClientMini[];
  paymentMethodsCatalog: PaymentMethod[];
  visibleColumns: EditorsColumnId[];
};

export function EditorsTable({
  editors,
  availableClients,
  paymentMethodsCatalog,
  visibleColumns,
}: Props) {
  if (editors.length === 0) {
    return (
      <p className="px-2 py-6 text-sm text-muted-foreground italic">
        No hay editores cargados todavía. Creá uno con «Nuevo editor».
      </p>
    );
  }

  const visible = new Set<EditorsColumnId>(visibleColumns);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {visible.has("name") && <TableHead>Nombre</TableHead>}
          {visible.has("clients") && <TableHead>Clientes</TableHead>}
          {visible.has("contact") && <TableHead>Contacto</TableHead>}
          {visible.has("discord") && <TableHead>Discord</TableHead>}
          {visible.has("payment_methods") && (
            <TableHead>Métodos de pago</TableHead>
          )}
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
        {editors.map((e) => (
          <TableRow key={e.id} className={e.disabled_at ? "opacity-50" : ""}>
            {visible.has("name") && (
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  {e.name}
                  {e.disabled_at && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500 ring-1 ring-amber-500/20">
                      Deshabilitado
                    </span>
                  )}
                </span>
              </TableCell>
            )}
            {visible.has("clients") && (
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
            )}
            {visible.has("contact") && (
              <TableCell className="max-w-[22ch] truncate text-muted-foreground">
                {((e.contact_links as ContactLink[] | null) ?? [])[0]?.value ?? "—"}
              </TableCell>
            )}
            {visible.has("discord") && (
              <TableCell>
                <DiscordLinkCell
                  editorId={e.id}
                  discordId={e.discord_id ?? null}
                  linkToken={e.discord_link_token ?? null}
                />
              </TableCell>
            )}
            {visible.has("payment_methods") && (
              <TableCell>
                <PaymentMethodChips methods={e.payment_methods} />
              </TableCell>
            )}
            {visible.has("docs") && (
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
            )}
            {visible.has("projects") && (
              <TableCell className="text-right tabular-nums">
                {e.project_count}
              </TableCell>
            )}
            {visible.has("actions") && (
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <EditEditorButton
                    editor={e}
                    availableClients={availableClients}
                    paymentMethodsCatalog={paymentMethodsCatalog}
                  />
                  <ToggleDisabledButton
                    id={e.id}
                    name={e.name}
                    disabledAt={e.disabled_at ?? null}
                  />
                  <DeleteEditorButton
                    id={e.id}
                    name={e.name}
                    projectCount={e.project_count}
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
