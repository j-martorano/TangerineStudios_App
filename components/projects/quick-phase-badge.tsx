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

import { changePhase } from "@/lib/projects/actions";
import { PROJECT_PHASES } from "@/lib/projects/types";
import type { ProjectPhase } from "@/lib/projects/types";
import { PHASE_CLASS, PHASE_LABEL } from "@/lib/projects/format";

type Props = {
  id: string;
  phase: ProjectPhase;
};

export function QuickPhaseBadge({ id, phase }: Props) {
  const [optimistic, setOptimistic] = useState<ProjectPhase | null>(null);
  const [pending, startTransition] = useTransition();

  const current = optimistic ?? phase;

  function handleChange(next: ProjectPhase) {
    if (next === current) return;
    const previous = current;
    setOptimistic(next);
    startTransition(async () => {
      const result = await changePhase(id, next);
      if (!result.ok) {
        toast.error(result.error);
        setOptimistic(previous);
      } else {
        toast.success("Fase actualizada");
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
            aria-label="Cambiar fase"
            className="cursor-pointer rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        }
      >
        <Badge variant="secondary" className={PHASE_CLASS[current]}>
          {PHASE_LABEL[current]}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {PROJECT_PHASES.map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={() => handleChange(p)}
            disabled={pending}
            className="cursor-pointer"
          >
            <Badge variant="secondary" className={PHASE_CLASS[p]}>
              {PHASE_LABEL[p]}
            </Badge>
            {current === p ? (
              <CheckIcon className="ml-auto size-4 text-muted-foreground" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
