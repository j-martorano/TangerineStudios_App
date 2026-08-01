"use client";

import { useState, useTransition } from "react";
import { todayAR } from "@/lib/argentina-date";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  deleteClientPayment,
  registerClientPayment,
} from "@/lib/clients/actions";
import type { ClientPayment } from "@/lib/projects/types";

type Props = {
  clientId: string;
  /** Rate por minuto guardado del cliente. */
  rate: number | null;
  /** % de descuento de retainer guardado. */
  discountPct: number;
  payments: ClientPayment[];
};

function fmtMin(n: number): string {
  const rounded = Number.isInteger(n) ? n : Number(n.toFixed(1));
  return `${rounded} min`;
}

function todayISO(): string {
  return todayAR();
}

/**
 * Sección de pagos de un cliente mensual. Cada pago se convierte a minutos
 * usando el rate efectivo (rate − descuento de retainer).
 */
export function ClientPaymentsSection({
  clientId,
  rate,
  discountPct,
  payments,
}: Props) {
  const effRate =
    rate != null && rate > 0 ? rate * (1 - discountPct / 100) : null;

  const totalCredited = payments.reduce(
    (sum, p) => sum + p.minutes_credited,
    0
  );

  return (
    <div className="flex flex-col gap-3">
      {effRate == null ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          Cargá un rate por minuto válido para poder registrar pagos.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Rate efectivo: {rate} − {discountPct}% ={" "}
          <span className="font-medium text-foreground tabular-nums">
            {effRate.toFixed(2)} USD/min
          </span>
        </p>
      )}

      {payments.length > 0 ? (
        <div className="flex flex-col divide-y divide-border/40 rounded-lg border">
          {payments.map((p) => (
            <PaymentRow key={p.id} payment={p} />
          ))}
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {payments.length} pago{payments.length === 1 ? "" : "s"}
            </span>
            <span className="font-medium tabular-nums">
              Total acreditado: {fmtMin(totalCredited)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          Sin pagos registrados todavía.
        </p>
      )}

      <AddPaymentRow clientId={clientId} effRate={effRate} />
    </div>
  );
}

function PaymentRow({ payment }: { payment: ClientPayment }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClientPayment(payment.id);
      if (result.ok) toast.success("Pago eliminado");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
      <div className="flex min-w-0 flex-col">
        <span className="font-medium tabular-nums">
          {payment.paid_at} · USD {payment.amount}
        </span>
        <span className="text-muted-foreground">
          {fmtMin(payment.minutes_credited)} acreditados
          {payment.note ? ` · ${payment.note}` : ""}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        onClick={handleDelete}
        aria-label="Eliminar pago"
        className="text-destructive hover:bg-destructive/20 hover:text-destructive"
      >
        <Trash2Icon className="size-4" />
      </Button>
    </div>
  );
}

function AddPaymentRow({
  clientId,
  effRate,
}: {
  clientId: string;
  effRate: number | null;
}) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const amountNum = Number(amount);
  const previewMinutes =
    effRate != null && amount !== "" && !Number.isNaN(amountNum)
      ? amountNum / effRate
      : null;

  function handleAdd() {
    if (amount === "" || Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    startTransition(async () => {
      const result = await registerClientPayment({
        client_id: clientId,
        amount: amountNum,
        paid_at: paidAt,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success("Pago registrado");
        setAmount("");
        setNote("");
        setPaidAt(todayISO());
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Monto USD
          </span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={pending || effRate == null}
            placeholder="0"
            className="h-8"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Fecha
          </span>
          <Input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            disabled={pending || effRate == null}
            className="h-8"
          />
        </div>
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={pending || effRate == null}
        placeholder="Nota (opcional)"
        className="h-8"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {previewMinutes != null
            ? `≈ ${fmtMin(previewMinutes)} a acreditar`
            : ""}
        </span>
        <Button
          type="button"
          size="sm"
          disabled={pending || effRate == null}
          onClick={handleAdd}
        >
          <PlusIcon className="size-4" />
          {pending ? "Registrando…" : "Registrar pago"}
        </Button>
      </div>
    </div>
  );
}
