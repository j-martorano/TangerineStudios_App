"use client";

import { useState, useTransition } from "react";
import { todayAR } from "@/lib/argentina-date";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  changeCobrado,
  deleteCobro,
  registerCobro,
} from "@/lib/projects/actions";
import { computePrice, formatPrice } from "@/lib/projects/format";
import { COBRADO_LABEL, COBRADO_CLASS } from "@/lib/projects/format";
import type {
  CobradoStatus,
  ProjectWithRelations,
} from "@/lib/projects/types";

type Props = {
  project: ProjectWithRelations;
  disabled?: boolean;
  /** Llamado después de cualquier mutación exitosa (registrar, borrar, cambiar estado). */
  onSuccess?: () => void;
};

function todayISO(): string {
  return todayAR();
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

function fmtDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(iso));
}

/**
 * Contenido del editor de cobros — totales, historial, form para sumar uno
 * nuevo y botones de estado. Se usa tal cual dentro del diálogo
 * `CobroManager` o embedded en una fila (ej. Finanzas → Por proyecto).
 */
export function CobroManagerPanel({ project, disabled = false, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const total = computePrice(project);
  const cobros = [...project.cobros].sort((a, b) =>
    a.paid_at.localeCompare(b.paid_at)
  );
  const cobrado = cobros.reduce((sum, c) => sum + Number(c.amount), 0);
  const remaining = total != null ? Math.max(0, total - cobrado) : null;

  function resetForm() {
    setAmount("");
    setPaidAt(todayISO());
    setNote("");
  }

  function handleRegister() {
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) {
      toast.error("Monto inválido");
      return;
    }
    startTransition(async () => {
      const result = await registerCobro({
        project_id: project.id,
        amount: n,
        paid_at: paidAt,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success("Cobro registrado");
        resetForm();
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCobro(id);
      if (result.ok) onSuccess?.();
      else toast.error(result.error);
    });
  }

  function handleStatus(next: CobradoStatus) {
    startTransition(async () => {
      const result = await changeCobrado(project.id, next);
      if (result.ok) onSuccess?.();
      else toast.error(result.error);
    });
  }

  function handleRegisterRemaining() {
    if (remaining == null || remaining <= 0) return;
    startTransition(async () => {
      const result = await registerCobro({
        project_id: project.id,
        amount: remaining,
        paid_at: paidAt,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success(`Cobro de ${formatPrice(remaining)} registrado`);
        resetForm();
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  const interactive = !disabled;

  return (
    <div className="flex flex-col gap-4">
      {/* Totales */}
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-center">
        <Total label="Total" value={total != null ? formatPrice(total) : "—"} />
        <Total
          label="Cobrado"
          value={formatPrice(cobrado)}
          tone="positive"
        />
        <Total
          label="Falta"
          value={remaining != null ? formatPrice(remaining) : "—"}
          tone={remaining && remaining > 0 ? "warning" : "muted"}
        />
      </div>

      {/* Lista de cobros */}
      {cobros.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Historial
          </p>
          <ul className="flex flex-col divide-y divide-border/40 rounded-md border border-border/40">
            {cobros.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 px-3 py-2 text-xs"
              >
                <span className="w-16 text-muted-foreground">
                  {fmtDate(c.paid_at)}
                </span>
                <span className="flex-1 truncate">
                  {c.note ? (
                    <span className="text-muted-foreground">{c.note}</span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </span>
                <span className="font-medium tabular-nums">
                  {formatPrice(Number(c.amount))}
                </span>
                {interactive ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    disabled={pending}
                    aria-label="Eliminar cobro"
                    className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                  >
                    <Trash2Icon className="size-3" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          Todavía no hay cobros registrados.
        </p>
      )}

      {interactive ? (
        <>
          {/* Agregar cobro */}
          <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/10 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Registrar cobro parcial
            </p>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-[10px]">Monto</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="h-8"
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px]">Fecha</Label>
                <Input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="h-8"
                  disabled={pending}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px]">Nota (opcional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anticipo, transferencia, etc."
                className="h-8"
                disabled={pending}
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRegister}
                disabled={pending}
              >
                Registrar
              </Button>
              {remaining != null && remaining > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRegisterRemaining}
                  disabled={pending}
                >
                  Registrar {formatPrice(remaining)} (resto)
                </Button>
              ) : null}
            </div>
          </div>

          {/* Estado */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Estado del cobro
            </p>
            <div className="flex gap-2">
              {(["no", "parcial", "si"] as CobradoStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatus(s)}
                  disabled={pending || project.cobrado === s}
                  className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    project.cobrado === s
                      ? `border-transparent ${COBRADO_CLASS[s]}`
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {COBRADO_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Badge clickeable que abre un diálogo con el `CobroManagerPanel` dentro.
 * Se usa en la columna «cobrado» de la tabla de Proyectos.
 */
export function CobroManager({ project, disabled = false }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className={`inline-flex w-fit cursor-pointer items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${COBRADO_CLASS[project.cobrado]}`}
          />
        }
      >
        {COBRADO_LABEL[project.cobrado]}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Cobros — {project.title}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${COBRADO_CLASS[project.cobrado]}`}
            >
              {COBRADO_LABEL[project.cobrado]}
            </span>
          </DialogTitle>
        </DialogHeader>
        <CobroManagerPanel project={project} disabled={disabled} />
      </DialogContent>
    </Dialog>
  );
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "warning" | "muted";
}) {
  const cls =
    tone === "positive"
      ? "text-emerald-500"
      : tone === "warning"
        ? "text-amber-500"
        : tone === "muted"
          ? "text-muted-foreground"
          : "";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${cls}`}>
        {value}
      </span>
    </div>
  );
}
