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

import { changeStatus } from "@/lib/projects/actions";
import { PROJECT_STATUSES } from "@/lib/projects/types";
import type { ProjectStatus } from "@/lib/projects/types";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/projects/format";

type Props = {
  id: string;
  status: ProjectStatus;
};

export function QuickStatusBadge({ id, status }: Props) {
  const [optimistic, setOptimistic] = useState<ProjectStatus | null>(null);
  const [pending, startTransition] = useTransition();

  const current = optimistic ?? status;

  function handleChange(next: ProjectStatus) {
    if (next === current) return;
    const previous = current;
    setOptimistic(next);
    startTransition(async () => {
      const result = await changeStatus(id, next);
      if (!result.ok) {
        toast.error(result.error);
        setOptimistic(previous);
      } else {
        toast.success("Estado actualizado");
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
            className="cursor-pointer rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        }
      >
        <Badge variant="secondary" className={STATUS_CLASS[current]}>
          {STATUS_LABEL[current]}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {PROJECT_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => handleChange(s)}
            disabled={pending}
          >
            <Badge variant="secondary" className={STATUS_CLASS[s]}>
              {STATUS_LABEL[s]}
            </Badge>
            {current === s ? (
              <CheckIcon className="ml-auto size-4 text-muted-foreground" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
