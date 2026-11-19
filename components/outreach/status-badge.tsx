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
import { updateOutreachStatus } from "@/lib/outreach/actions";
import {
  OUTREACH_STATUSES,
  STATUS_CLASS,
  STATUS_LABEL,
  type OutreachStatus,
} from "@/lib/outreach/types";

export function StatusBadge({ status }: { status: OutreachStatus }) {
  return (
    <Badge variant="secondary" className={STATUS_CLASS[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Badge de estado que se cambia desde un menú, sin abrir el mensaje. */
export function QuickStatusBadge({ id, status }: { id: string; status: OutreachStatus }) {
  const [optimistic, setOptimistic] = useState<OutreachStatus | null>(null);
  const [pending, startTransition] = useTransition();
  const current = optimistic ?? status;

  function change(next: OutreachStatus) {
    if (next === current) return;
    const previous = current;
    setOptimistic(next);
    startTransition(async () => {
      const res = await updateOutreachStatus(id, next);
      if (!res.ok) {
        toast.error(res.error);
        setOptimistic(previous);
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
            aria-label="Cambiar estado"
            onClick={(e) => e.stopPropagation()}
            className="cursor-pointer rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        }
      >
        <StatusBadge status={current} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {OUTREACH_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => change(s)}
            disabled={pending}
            className="cursor-pointer"
          >
            <StatusBadge status={s} />
            {current === s ? <CheckIcon className="ml-auto size-4 text-muted-foreground" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
