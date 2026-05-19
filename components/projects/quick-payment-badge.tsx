"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  changeCobrado,
  changeInvoiced,
  changePagado,
} from "@/lib/projects/actions";
import {
  COBRADO_CLASS,
  COBRADO_LABEL,
  INVOICED_CLASS,
  INVOICED_LABEL,
  PAGADO_CLASS,
  PAGADO_LABEL,
} from "@/lib/projects/format";
import {
  COBRADO_STATUSES,
  INVOICED_STATUSES,
  PAGADO_STATUSES,
} from "@/lib/projects/types";
import type {
  CobradoStatus,
  InvoicedStatus,
  PagadoStatus,
} from "@/lib/projects/types";

type Props = (
  | { kind: "cobrado"; id: string; value: CobradoStatus }
  | { kind: "pagado"; id: string; value: PagadoStatus }
  | { kind: "invoiced"; id: string; value: InvoicedStatus }
) & {
  /** Proyecto finalizado: el estado queda bloqueado (badge no interactivo). */
  disabled?: boolean;
};

type Config = {
  options: readonly string[];
  labels: Record<string, string>;
  classes: Record<string, string>;
  action: (id: string, value: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  ariaLabel: string;
  successMessage: string;
};

const CONFIG: Record<Props["kind"], Config> = {
  cobrado: {
    options: COBRADO_STATUSES,
    labels: COBRADO_LABEL,
    classes: COBRADO_CLASS,
    action: changeCobrado as Config["action"],
    ariaLabel: "Cambiar estado de cobro",
    successMessage: "Cobrado actualizado",
  },
  pagado: {
    options: PAGADO_STATUSES,
    labels: PAGADO_LABEL,
    classes: PAGADO_CLASS,
    action: changePagado as Config["action"],
    ariaLabel: "Cambiar estado de pago al editor",
    successMessage: "Pago al editor actualizado",
  },
  invoiced: {
    options: INVOICED_STATUSES,
    labels: INVOICED_LABEL,
    classes: INVOICED_CLASS,
    action: changeInvoiced as Config["action"],
    ariaLabel: "Cambiar estado de facturación",
    successMessage: "Facturación actualizada",
  },
};

export function QuickPaymentBadge(props: Props) {
  const cfg = CONFIG[props.kind];
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = optimistic ?? props.value;

  if (props.disabled) {
    return (
      <Badge variant="secondary" className={cfg.classes[current]}>
        {cfg.labels[current]}
      </Badge>
    );
  }

  function handleChange(next: string) {
    if (next === current) return;
    const previous = current;
    setOptimistic(next);
    startTransition(async () => {
      const result = await cfg.action(props.id, next);
      if (!result.ok) {
        toast.error(result.error);
        setOptimistic(previous);
      } else {
        toast.success(cfg.successMessage);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={pending}
            aria-label={cfg.ariaLabel}
            className="cursor-pointer rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        }
      >
        <Badge variant="secondary" className={cfg.classes[current]}>
          {cfg.labels[current]}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {cfg.options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onClick={() => handleChange(opt)}
            disabled={pending}
            className="cursor-pointer"
          >
            <Badge variant="secondary" className={cfg.classes[opt]}>
              {cfg.labels[opt]}
            </Badge>
            {current === opt ? (
              <CheckIcon className="ml-auto size-4 text-muted-foreground" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
