"use client";

import { useState, useTransition } from "react";
import { todayAR } from "@/lib/argentina-date";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { registerClientPayment } from "@/lib/clients/actions";

export type RetainerClient = {
  id: string;
  name: string;
  color: string;
  rate: number | null;
  discountPct: number;
};

function fmtMin(n: number): string {
  const rounded = Number.isInteger(n) ? n : Number(n.toFixed(1));
  return `${rounded} min`;
}

function todayISO(): string {
  return todayAR();
}

/**
 * Botón + dialog para registrar un pago de un cliente retainer desde Finanzas.
 * Solo aparecen clientes con payment_type='mensual'.
 */
export function RegisterRetainerPaymentDialog({
  clients,
}: {
  clients: RetainerClient[];
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = clients.find((c) => c.id === clientId) ?? null;
  const effRate =
    selected && selected.rate != null && selected.rate > 0
      ? selected.rate * (1 - selected.discountPct / 100)
      : null;
  const amountNum = Number(amount);
  const previewMinutes =
    effRate != null && amount !== "" && !Number.isNaN(amountNum) && amountNum > 0
      ? amountNum / effRate
      : null;

  function reset() {
    setClientId(null);
    setAmount("");
    setPaidAt(todayISO());
    setNote("");
  }

  function handleSubmit() {
    if (!selected) {
      toast.error("Elegí un cliente");
      return;
    }
    if (effRate == null) {
      toast.error(
        `${selected.name} no tiene un rate por minuto cargado — no se puede acreditar`
      );
      return;
    }
    if (amount === "" || Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    startTransition(async () => {
      const result = await registerClientPayment({
        client_id: selected.id,
        amount: amountNum,
        paid_at: paidAt,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success(`Pago de ${selected.name} registrado`);
        reset();
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (clients.length === 0) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon className="size-4" />
        Registrar pago
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago retainer</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-client">Cliente</Label>
            <Select
              value={clientId ?? ""}
              onValueChange={(v) => v && setClientId(v)}
            >
              <SelectTrigger id="payment-client" className="w-full">
                <SelectValue>
                  {(v: string | null) => {
                    if (!v) return "Elegí un cliente";
                    const c = clients.find((cl) => cl.id === v);
                    if (!c) return "—";
                    return (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.name}
                      </span>
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            effRate != null ? (
              <p className="text-xs text-muted-foreground">
                Rate efectivo: {selected.rate} − {selected.discountPct}% ={" "}
                <span className="font-medium text-foreground tabular-nums">
                  {effRate.toFixed(2)} USD/min
                </span>
              </p>
            ) : (
              <p className="text-xs text-amber-500">
                Este cliente no tiene rate por minuto cargado. Editalo desde
                Clientes antes de registrar el pago.
              </p>
            )
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-amount">Monto USD</Label>
              <Input
                id="payment-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                disabled={pending || effRate == null}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-date">Fecha</Label>
              <Input
                id="payment-date"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                disabled={pending || effRate == null}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-note">Nota (opcional)</Label>
            <Input
              id="payment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Pago mayo 2026"
              disabled={pending || effRate == null}
            />
          </div>

          {previewMinutes != null ? (
            <p className="text-xs text-muted-foreground">
              Se van a acreditar ≈{" "}
              <span className="font-medium text-foreground tabular-nums">
                {fmtMin(previewMinutes)}
              </span>
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" type="button" />}>
            Cancelar
          </DialogClose>
          <Button
            type="button"
            disabled={pending || effRate == null}
            onClick={handleSubmit}
          >
            {pending ? "Registrando…" : "Registrar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
