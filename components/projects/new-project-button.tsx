"use client";

import { useState, useTransition } from "react";
import { BanknoteIcon, ClockIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

import { ProjectForm, type ParentOption } from "./project-form";
import { registerClientPayment } from "@/lib/clients/actions";
import type { ClientForProject, EditorMini } from "@/lib/projects/types";

const btnBase =
  "inline-flex items-center gap-2 text-sm font-medium transition-colors active:scale-[0.98]";
const btnStyle = { borderRadius: "6px", padding: "6px 12px" };

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function NewProjectButton({
  editors,
  clients,
  availableParents = [],
}: {
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={`${btnBase} bg-[#FFAC37] text-black hover:bg-[#FFAC37]/85`}
            style={btnStyle}
          />
        }
      >
        <PlusIcon className="size-4" />
        Nuevo Proyecto
      </DialogTrigger>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>
            Cargá los datos. Si el cliente no está en la lista, lo creás desde
            el combobox.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          mode="create"
          editors={editors}
          clients={clients}
          availableParents={availableParents}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function NewHistoricProjectButton({
  editors,
  clients,
  availableParents = [],
}: {
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={`${btnBase} border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80`}
            style={btnStyle}
          />
        }
      >
        <ClockIcon className="size-4" />
        Nuevo Proyecto Histórico
      </DialogTrigger>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Nuevo proyecto histórico</DialogTitle>
          <DialogDescription>
            Cargá un proyecto ya terminado. Elegí la fecha en que se terminó
            para que aparezca en el mes correcto.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          mode="create"
          editors={editors}
          clients={clients}
          availableParents={availableParents}
          initialPhase="terminado"
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function NewClientPaymentButton({
  clients,
}: {
  clients: ClientForProject[];
}) {
  const mensualClients = clients.filter((c) => c.payment_type === "mensual");

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(currentYearMonth);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function handleOpenChange(v: boolean) {
    if (v && mensualClients.length > 0 && !clientId) {
      setClientId(mensualClients[0].id);
    }
    setOpen(v);
  }

  function handleSubmit() {
    const amountNum = parseFloat(amount);
    if (!clientId || isNaN(amountNum) || amountNum <= 0 || !month) {
      toast.error("Completá todos los campos requeridos");
      return;
    }
    startTransition(async () => {
      const r = await registerClientPayment({
        client_id: clientId,
        amount: amountNum,
        paid_at: `${month}-01`,
        note: note.trim() || null,
      });
      if (r.ok) {
        toast.success("Pago acreditado");
        setAmount("");
        setNote("");
        setMonth(currentYearMonth());
        setOpen(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={`${btnBase} border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80`}
            style={btnStyle}
          />
        }
      >
        <BanknoteIcon className="size-4" />
        Nuevo Pago
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo pago mensual</DialogTitle>
          <DialogDescription>
            Acreditá el cobro de un cliente con modalidad mensual.
          </DialogDescription>
        </DialogHeader>

        {mensualClients.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No hay clientes con modalidad mensual cargados.
          </p>
        ) : (
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-client">Cliente</Label>
              <Select value={clientId} onValueChange={(v) => v && setClientId(v)}>
                <SelectTrigger id="cp-client" className="w-full">
                  <SelectValue placeholder="Elegí un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {mensualClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-amount">Monto (USD)</Label>
              <Input
                id="cp-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-month">Mes</Label>
              <Input
                id="cp-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cp-note">
                Nota{" "}
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="cp-note"
                placeholder="Ej: transferencia bancaria"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              pending ||
              mensualClients.length === 0 ||
              !clientId ||
              !amount ||
              parseFloat(amount) <= 0
            }
          >
            {pending ? "Acreditando…" : "Acreditar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
