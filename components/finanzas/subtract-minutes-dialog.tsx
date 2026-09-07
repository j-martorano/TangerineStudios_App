"use client";

import { useState, useTransition } from "react";
import { todayAR } from "@/lib/argentina-date";
import { MinusIcon } from "lucide-react";
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

import { registerClientMinutesDebit } from "@/lib/clients/actions";
import type { RetainerClient } from "./register-retainer-payment-dialog";

function fmtMin(n: number): string {
  const rounded = Number.isInteger(n) ? n : Number(n.toFixed(1));
  return `${rounded} min`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function todayLabel(): string {
  return DATE_FORMATTER.format(new Date(`${todayAR()}T12:00:00Z`));
}

/**
 * Botón + dialog para restar minutos del saldo mensual de un cliente retainer.
 * Queda registrado con la fecha del día en que se hace el registro (no se
 * elige fecha) y sin monto: es un ajuste de saldo, no un ingreso.
 */
export function SubtractMinutesDialog({
  clients,
  clientId: fixedClientId,
  triggerLabel = "Restar minutos",
  triggerClassName,
}: {
  clients: RetainerClient[];
  /** Si viene, el cliente queda fijo y no se muestra el selector. */
  clientId?: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(
    fixedClientId ?? null
  );
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = clients.find((c) => c.id === (fixedClientId ?? clientId));
  const minutesNum = Number(minutes);
  const validMinutes =
    minutes !== "" && !Number.isNaN(minutesNum) && minutesNum > 0;

  function reset() {
    setClientId(fixedClientId ?? null);
    setMinutes("");
    setNote("");
  }

  function handleSubmit() {
    if (!selected) {
      toast.error("Elegí un cliente");
      return;
    }
    if (!validMinutes) {
      toast.error("Ingresá una cantidad de minutos válida");
      return;
    }
    startTransition(async () => {
      const result = await registerClientMinutesDebit({
        client_id: selected.id,
        minutes: minutesNum,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success(
          `${fmtMin(minutesNum)} restados del saldo de ${selected.name}`
        );
        reset();
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (clients.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className={triggerClassName} />
        }
      >
        <MinusIcon className="size-4" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restar minutos mensuales</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {fixedClientId ? null : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="debit-client">Cliente</Label>
              <Select
                value={clientId ?? ""}
                onValueChange={(v) => v && setClientId(v)}
              >
                <SelectTrigger id="debit-client" className="w-full">
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
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="debit-minutes">Minutos a restar</Label>
            <Input
              id="debit-minutes"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="0"
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="debit-note">Nota (opcional)</Label>
            <Input
              id="debit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Ajuste de minutos no usados"
              disabled={pending}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Se registra con la fecha de hoy —{" "}
            <span className="font-medium text-foreground">{todayLabel()}</span>.
            No cuenta como ingreso: solo baja el saldo de minutos
            {validMinutes ? (
              <>
                {" "}
                en{" "}
                <span className="font-medium text-destructive tabular-nums">
                  −{fmtMin(minutesNum)}
                </span>
              </>
            ) : null}
            .
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" type="button" />}>
            Cancelar
          </DialogClose>
          <Button
            type="button"
            disabled={pending || !validMinutes || !selected}
            onClick={handleSubmit}
          >
            {pending ? "Restando…" : "Restar minutos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
