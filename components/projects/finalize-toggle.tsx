"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { setProjectFinalized } from "@/lib/projects/actions";

type Props = {
  id: string;
  title: string;
  finalized: boolean;
};

/**
 * Casillero clickeable de "finalizado". Al tildarlo el proyecto se cierra:
 * sale del kanban, se bloquea la edición y entra a Finanzas. Destildarlo lo
 * reabre.
 */
export function FinalizeToggle({ id, title, finalized: initial }: Props) {
  const [finalized, setFinalized] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !finalized;
    setFinalized(next);
    startTransition(async () => {
      const result = await setProjectFinalized(id, next);
      if (!result.ok) {
        toast.error(result.error);
        setFinalized(!next);
      } else {
        toast.success(
          next ? `«${title}» finalizado` : `«${title}» reabierto`
        );
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={finalized}
      aria-label={
        finalized ? "Reabrir proyecto" : "Marcar proyecto como finalizado"
      }
      title={
        finalized
          ? "Finalizado — clickeá para reabrir y poder editar"
          : "Marcar como finalizado"
      }
      className={`flex size-5 cursor-pointer items-center justify-center rounded border transition-colors disabled:opacity-50 ${
        finalized
          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500"
          : "border-foreground/30 hover:border-foreground/60 hover:bg-accent"
      }`}
    >
      {finalized ? <CheckIcon className="size-3.5" /> : null}
    </button>
  );
}
