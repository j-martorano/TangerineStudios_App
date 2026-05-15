"use client";

import { useState, useTransition } from "react";
import { CheckIcon, UndoIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { changeCobrado, changePagado } from "@/lib/projects/actions";

type Props = {
  projectId: string;
  field: "cobrado" | "pagado";
  /** Estado actual leído de la DB. Si true, el botón muestra "Deshacer". */
  settled: boolean;
  /** Etiqueta para el toast (ej. "001-acme — cobrado"). */
  description: string;
};

export function ProjectSettleButton({
  projectId,
  field,
  settled: initialSettled,
  description,
}: Props) {
  const [settled, setSettled] = useState(initialSettled);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !settled;
    setSettled(next);
    startTransition(async () => {
      const result =
        field === "cobrado"
          ? await changeCobrado(projectId, next ? "si" : "no")
          : await changePagado(
              projectId,
              next ? "pago_total" : "sin_pagar"
            );
      if (!result.ok) {
        toast.error(result.error);
        setSettled(!next);
      } else {
        toast.success(
          next
            ? `${description} marcado como saldado`
            : `${description} reabierto`
        );
      }
    });
  }

  if (settled) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={handleClick}
        className="text-emerald-500 hover:text-emerald-400"
      >
        <CheckIcon className="size-3.5" />
        Saldado
        <UndoIcon className="ml-1 size-3 opacity-60" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? "Marcando…" : "Marcar saldado"}
    </Button>
  );
}
