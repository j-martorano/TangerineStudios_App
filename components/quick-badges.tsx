"use client";

import { useState, type ReactNode } from "react";
import { PlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type QuickBadgeOption = {
  id: string;
  label: string;
  /** Texto chico debajo del nombre en el menú de agregar. */
  hint?: string;
  /** Aviso sobre un badge ya asignado (ícono con tooltip). */
  warning?: string;
};

type Props = {
  /** Ids asignados hoy, en el orden en que se muestran. */
  selected: string[];
  /** Todo lo asignable, incluidos los ya asignados. */
  options: QuickBadgeOption[];
  /**
   * Guarda la lista completa nueva y devuelve si salió bien. Mientras tanto el
   * cambio se muestra como hecho; si falla, vuelve atrás.
   */
  onChange: (next: string[]) => Promise<boolean>;
  /** Texto del badge «+». */
  addLabel: string;
  /** Qué mostrar cuando no hay nada asignado (además del «+»). */
  emptyLabel?: ReactNode;
  disabled?: boolean;
  className?: string;
};

/**
 * Lista de badges editable en el lugar, al estilo de las acciones rápidas del
 * spreadsheet (QuickPhaseBadge): cada badge se saca con su «×» y el badge «+»
 * abre un menú con lo que falta agregar. Sin pasar por un formulario.
 */
export function QuickBadges({
  selected,
  options,
  onChange,
  addLabel,
  emptyLabel,
  disabled,
  className,
}: Props) {
  // Optimista: se muestra el cambio al instante y se descarta cuando llega la
  // lista nueva del servidor (cambia `key`) o si el guardado falla.
  const key = selected.join("|");
  const [optimistic, setOptimistic] = useState<{ key: string; ids: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const current = optimistic && optimistic.key === key ? optimistic.ids : selected;

  const byId = new Map(options.map((o) => [o.id, o]));
  const shown = current
    .map((id) => byId.get(id))
    .filter((o): o is QuickBadgeOption => o != null);
  const available = options.filter((o) => !current.includes(o.id));
  const busy = disabled || saving;

  async function apply(next: string[]) {
    setOptimistic({ key, ids: next });
    setSaving(true);
    const ok = await onChange(next);
    setSaving(false);
    if (!ok) setOptimistic(null);
  }

  return (
    <div className={cn("flex select-none flex-wrap items-center gap-1", className)}>
      {shown.length === 0 && emptyLabel ? emptyLabel : null}
      {shown.map((o) => (
        <Badge key={o.id} variant="secondary" className="gap-1 pr-1 font-normal">
          {o.warning ? (
            <TriangleAlertIcon className="text-primary" aria-label={o.warning} />
          ) : null}
          <span title={o.warning}>{o.label}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => apply(current.filter((id) => id !== o.id))}
            aria-label={`Sacar ${o.label}`}
            title={`Sacar ${o.label}`}
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      {available.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                disabled={busy}
                aria-label={addLabel}
                className="cursor-pointer rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
            }
          >
            <Badge
              variant="outline"
              className="gap-1 border-dashed font-normal text-muted-foreground"
            >
              <PlusIcon />
              {addLabel}
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
            {available.map((o) => (
              <DropdownMenuItem
                key={o.id}
                onClick={() => apply([...current, o.id])}
                className="cursor-pointer items-start"
              >
                <div className="flex flex-col">
                  <span>{o.label}</span>
                  {o.hint ? (
                    <span className="text-xs whitespace-normal text-muted-foreground">
                      {o.hint}
                    </span>
                  ) : null}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
