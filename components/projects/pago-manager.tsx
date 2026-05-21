"use client";

import { useState, useTransition } from "react";
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
  changePagado,
  deleteEditorPago,
  registerEditorPago,
} from "@/lib/projects/actions";
import {
  PAGADO_LABEL,
  PAGADO_CLASS,
  editorCostInProject,
  formatPrice,
} from "@/lib/projects/format";
import type {
  PagadoStatus,
  ProjectWithRelations,
} from "@/lib/projects/types";

type Props = {
  project: ProjectWithRelations;
  disabled?: boolean;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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
 * Contenido del editor de pagos por editor (sin envoltorio de diálogo).
 * Cada editor del proyecto tiene su propia sub-sección con sus totales,
 * historial y form. Al pie, botones de estado global del proyecto.
 */
export function PagoManagerPanel({ project, disabled = false }: Props) {
  const [pending, startTransition] = useTransition();
  const editorsInProject = project.editors.filter((e) => e.editor != null);

  function handleStatus(next: PagadoStatus) {
    startTransition(async () => {
      const result = await changePagado(project.id, next);
      if (!result.ok) toast.error(result.error);
    });
  }

  const interactive = !disabled;

  return (
    <div className="flex flex-col gap-4">
      {editorsInProject.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          Este proyecto no tiene editores asignados — no hay nada para
          pagar.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {editorsInProject.map((entry) => (
            <EditorSection
              key={entry.editor!.id}
              project={project}
              editorId={entry.editor!.id}
              editorName={entry.editor!.name}
              pending={pending}
              startTransition={startTransition}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {interactive ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Estado global del pago
          </p>
          <div className="flex gap-2">
            {(["sin_pagar", "parcial", "pago_total"] as PagadoStatus[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatus(s)}
                  disabled={pending || project.pagado === s}
                  className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    project.pagado === s
                      ? `border-transparent ${PAGADO_CLASS[s]}`
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {PAGADO_LABEL[s]}
                </button>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Badge clickeable que abre un diálogo con el `PagoManagerPanel` dentro.
 * Se usa en la columna «pagado» de la tabla de Proyectos.
 */
export function PagoManager({ project, disabled = false }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className={`inline-flex w-fit cursor-pointer items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${PAGADO_CLASS[project.pagado]}`}
          />
        }
      >
        {PAGADO_LABEL[project.pagado]}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Pagos — {project.title}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAGADO_CLASS[project.pagado]}`}
            >
              {PAGADO_LABEL[project.pagado]}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          <PagoManagerPanel project={project} disabled={disabled} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditorSection({
  project,
  editorId,
  editorName,
  pending,
  startTransition,
  disabled,
}: {
  project: ProjectWithRelations;
  editorId: string;
  editorName: string;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  disabled: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [note, setNote] = useState("");

  const cost = editorCostInProject(project, editorId);
  const pagos = project.editor_pagos
    .filter((p) => p.editor_id === editorId)
    .sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  const pagado = pagos.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = cost != null ? Math.max(0, cost - pagado) : null;

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
      const result = await registerEditorPago({
        project_id: project.id,
        editor_id: editorId,
        amount: n,
        paid_at: paidAt,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success(`Pago a ${editorName} registrado`);
        resetForm();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteEditorPago(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleRegisterRemaining() {
    if (remaining == null || remaining <= 0) return;
    startTransition(async () => {
      const result = await registerEditorPago({
        project_id: project.id,
        editor_id: editorId,
        amount: remaining,
        paid_at: paidAt,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success(
          `Pago de ${formatPrice(remaining)} a ${editorName} registrado`
        );
        resetForm();
      } else {
        toast.error(result.error);
      }
    });
  }

  const fullyPaid = cost != null && remaining === 0 && pagado > 0;
  const interactive = !disabled;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{editorName}</p>
        {fullyPaid ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
            Saldado
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <SubTotal
          label="Cost"
          value={cost != null ? formatPrice(cost) : "—"}
        />
        <SubTotal
          label="Pagado"
          value={formatPrice(pagado)}
          tone="positive"
        />
        <SubTotal
          label="Falta"
          value={remaining != null ? formatPrice(remaining) : "—"}
          tone={remaining && remaining > 0 ? "warning" : "muted"}
        />
      </div>

      {pagos.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border/40 rounded-md border border-border/40 text-xs">
          {pagos.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-14 text-muted-foreground">
                {fmtDate(p.paid_at)}
              </span>
              <span className="flex-1 truncate text-muted-foreground">
                {p.note ?? "—"}
              </span>
              <span className="font-medium tabular-nums">
                {formatPrice(Number(p.amount))}
              </span>
              {interactive ? (
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  disabled={pending}
                  aria-label="Eliminar pago"
                  className="inline-flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2Icon className="size-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {interactive ? (
        <div className="flex flex-col gap-2 rounded-md bg-muted/30 p-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Monto"
              className="h-8"
              disabled={pending}
            />
            <Input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="h-8 w-[140px]"
              disabled={pending}
            />
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)"
            className="h-8"
            disabled={pending}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleRegister}
              disabled={pending}
            >
              Registrar pago
            </Button>
            {remaining != null && remaining > 0 ? (
              <Button
                type="button"
                size="sm"
                onClick={handleRegisterRemaining}
                disabled={pending}
              >
                Registrar pago {formatPrice(remaining)} (resto)
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SubTotal({
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
      <span className={`text-xs font-semibold tabular-nums ${cls}`}>
        {value}
      </span>
    </div>
  );
}
