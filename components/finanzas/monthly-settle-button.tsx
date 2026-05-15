"use client";

import { useState, useTransition } from "react";
import { CheckIcon, UndoIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setMonthlySettlement } from "@/lib/finanzas/actions";

type Props = {
  yearMonth: string;
  partyType: "client_cobro" | "editor_pago";
  partyId: string;
  settled: boolean;
  /** Etiqueta para el toast (ej. "Cobro de Acme — mayo 2026"). */
  description: string;
};

export function MonthlySettleButton({
  yearMonth,
  partyType,
  partyId,
  settled: initialSettled,
  description,
}: Props) {
  const [settled, setSettled] = useState(initialSettled);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !settled;
    setSettled(next);
    startTransition(async () => {
      const result = await setMonthlySettlement({
        year_month: yearMonth,
        party_type: partyType,
        party_id: partyId,
        settled: next,
      });
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
        onClick={handleToggle}
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
      onClick={handleToggle}
    >
      {pending ? "Marcando…" : "Marcar saldado"}
    </Button>
  );
}
