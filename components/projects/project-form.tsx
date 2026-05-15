"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { ClientCombobox } from "@/components/clients/client-combobox";

import {
  COBRADO_STATUSES,
  CURRENCIES,
  INVOICED_STATUSES,
  PAGADO_STATUSES,
  PROJECT_PHASES,
  getPrimaryEditor,
  getSecondaryEditor,
} from "@/lib/projects/types";
import type {
  ClientMini,
  CobradoStatus,
  CurrencyCode,
  EditorMini,
  InvoicedStatus,
  PagadoStatus,
  ProjectPhase,
  ProjectWithRelations,
} from "@/lib/projects/types";
import {
  COBRADO_LABEL,
  CURRENCY_LABEL,
  INVOICED_LABEL,
  PAGADO_LABEL,
  PHASE_LABEL,
  computeCost,
  computePrice,
  computeProfit,
  formatPrice,
} from "@/lib/projects/format";
import { createProject, updateProject } from "@/lib/projects/actions";

const NO_EDITOR = "__none__";

type Props = {
  mode: "create" | "edit";
  editors: EditorMini[];
  clients: ClientMini[];
  project?: ProjectWithRelations;
  onSuccess?: () => void;
};

export function ProjectForm({
  mode,
  editors,
  clients,
  project,
  onSuccess,
}: Props) {
  const initialPrimary = project ? getPrimaryEditor(project) : null;
  const initialSecondary = project ? getSecondaryEditor(project) : null;

  const [title, setTitle] = useState(project?.title ?? "");
  const [clientId, setClientId] = useState<string | null>(
    project?.client?.id ?? null
  );
  const [phase, setPhase] = useState<ProjectPhase>(
    project?.phase ?? "por_asignar"
  );
  const [cobrado, setCobrado] = useState<CobradoStatus>(
    project?.cobrado ?? "no"
  );
  const [pagado, setPagado] = useState<PagadoStatus>(
    project?.pagado ?? "sin_pagar"
  );
  const [invoiced, setInvoiced] = useState<InvoicedStatus>(
    project?.invoiced ?? "no"
  );
  const [manualPrice, setManualPrice] = useState<string>(
    project?.price != null ? String(project.price) : ""
  );
  const [currency, setCurrency] = useState<CurrencyCode>(
    project?.currency ?? "ARS"
  );
  const [durationMinutes, setDurationMinutes] = useState<string>(
    project?.duration_minutes != null ? String(project.duration_minutes) : ""
  );
  const [primaryEditorId, setPrimaryEditorId] = useState<string>(
    initialPrimary?.editor?.id ?? NO_EDITOR
  );
  const [hasSecondary, setHasSecondary] = useState<boolean>(
    initialSecondary != null
  );
  const [secondaryEditorId, setSecondaryEditorId] = useState<string>(
    initialSecondary?.editor?.id ?? NO_EDITOR
  );
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      toast.error("El título es obligatorio");
      return;
    }

    const parsedPrice =
      manualPrice === "" ? null : Number(manualPrice);
    if (parsedPrice !== null && Number.isNaN(parsedPrice)) {
      toast.error("Precio inválido");
      return;
    }

    const parsedDuration =
      durationMinutes === "" ? null : Number(durationMinutes);
    if (parsedDuration !== null && Number.isNaN(parsedDuration)) {
      toast.error("Duración inválida");
      return;
    }

    const primaryId =
      primaryEditorId === NO_EDITOR ? null : primaryEditorId;
    const secondaryId =
      !hasSecondary || secondaryEditorId === NO_EDITOR
        ? null
        : secondaryEditorId;

    if (secondaryId && secondaryId === primaryId) {
      toast.error("El segundo editor no puede ser el mismo que el principal");
      return;
    }

    // El precio sólo se guarda cuando el cliente es 'por_proyecto' (manual).
    // Para 'por_rate' y 'mensual' se calcula on-read desde rate o monthly_fee.
    const selectedClient = clients.find((c) => c.id === clientId) ?? null;
    const priceToStore =
      selectedClient?.payment_type === "por_proyecto" ? parsedPrice : null;

    const payload = {
      title: trimmedTitle,
      client_id: clientId,
      phase,
      cobrado,
      pagado,
      invoiced,
      price: priceToStore,
      cost: null,
      currency,
      duration_minutes: parsedDuration,
      primary_editor_id: primaryId,
      secondary_editor_id: secondaryId,
      secondary_editor_cost: null,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createProject(payload)
          : await updateProject(project!.id, payload);

      if (result.ok) {
        toast.success(
          mode === "create" ? "Proyecto creado" : "Cambios guardados"
        );
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  const editorById = new Map(editors.map((ed) => [ed.id, ed.name]));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">
            Título <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            placeholder="Reel demo 2026 — Acme"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Cliente</Label>
          <ClientCombobox
            clients={clients}
            value={clientId}
            onChange={(id) => setClientId(id)}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phase">Fase</Label>
              <Select
                value={phase}
                onValueChange={(v) => v && setPhase(v as ProjectPhase)}
              >
                <SelectTrigger id="phase" className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? PHASE_LABEL[v as ProjectPhase] : ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_PHASES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PHASE_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="duration_minutes">
                Duración{" "}
                <span className="text-xs text-muted-foreground">(min)</span>
              </Label>
              <Input
                id="duration_minutes"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select
                value={currency}
                onValueChange={(v) => v && setCurrency(v as CurrencyCode)}
              >
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue>
                    {(v: string | null) => (v ? v : "")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURRENCY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const selectedClient =
                clients.find((c) => c.id === clientId) ?? null;
              if (selectedClient?.payment_type !== "por_proyecto") return null;
              return (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="price">
                    Precio{" "}
                    <span className="text-xs text-muted-foreground">
                      (manual)
                    </span>
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>
              );
            })()}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="primary_editor_id">Editor principal</Label>
          <Select
            value={primaryEditorId}
            onValueChange={(v) => setPrimaryEditorId(v ?? NO_EDITOR)}
          >
            <SelectTrigger id="primary_editor_id" className="w-full">
              <SelectValue>
                {(v: string | null) => {
                  if (!v || v === NO_EDITOR) return "Sin asignar";
                  return editorById.get(v) ?? "—";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_EDITOR}>Sin asignar</SelectItem>
              {editors.map((ed) => (
                <SelectItem key={ed.id} value={ed.id}>
                  {ed.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              checked={hasSecondary}
              onChange={(e) => setHasSecondary(e.target.checked)}
              className="size-4 cursor-pointer accent-primary"
            />
            <span>Segundo editor</span>
          </label>

          {hasSecondary ? (
            <div className="mt-1 flex flex-col gap-2">
              <Label htmlFor="secondary_editor_id" className="text-xs">
                Editor secundario
              </Label>
              <Select
                value={secondaryEditorId}
                onValueChange={(v) => setSecondaryEditorId(v ?? NO_EDITOR)}
              >
                <SelectTrigger
                  id="secondary_editor_id"
                  className="w-full"
                >
                  <SelectValue>
                    {(v: string | null) => {
                      if (!v || v === NO_EDITOR) return "Sin asignar";
                      return editorById.get(v) ?? "—";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_EDITOR}>Sin asignar</SelectItem>
                  {editors
                    .filter((ed) => ed.id !== primaryEditorId)
                    .map((ed) => (
                      <SelectItem key={ed.id} value={ed.id}>
                        {ed.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {/* Preview de precio / costo / ganancia con la lógica nueva. */}
        {(() => {
          const selectedClient =
            clients.find((c) => c.id === clientId) ?? null;
          const parsedDur =
            durationMinutes === "" ? null : Number(durationMinutes);
          const parsedPrice =
            manualPrice === "" ? null : Number(manualPrice);
          const primary = editors.find((ed) => ed.id === primaryEditorId) ?? null;
          const secondary = hasSecondary
            ? editors.find((ed) => ed.id === secondaryEditorId) ?? null
            : null;
          const editorEntries = [
            primary ? { role: "primary" as const, cost: null, editor: primary } : null,
            secondary
              ? { role: "secondary" as const, cost: null, editor: secondary }
              : null,
          ].filter((e): e is NonNullable<typeof e> => e != null);
          const preview = {
            duration_minutes:
              parsedDur != null && !Number.isNaN(parsedDur) ? parsedDur : null,
            price:
              selectedClient?.payment_type === "por_proyecto" &&
              parsedPrice != null &&
              !Number.isNaN(parsedPrice)
                ? parsedPrice
                : null,
            client: selectedClient,
            editors: editorEntries,
          };
          const computedPrice = computePrice(preview);
          const computedCost = computeCost(preview);
          const computedProfit = computeProfit(preview);
          const isMensual = selectedClient?.payment_type === "mensual";
          return (
            <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Precio (calc.)</span>
                <span className="font-medium tabular-nums">
                  {isMensual
                    ? "Mensual"
                    : computedPrice != null
                      ? formatPrice(computedPrice, currency)
                      : "—"}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Costo (calc.)</span>
                <span className="font-medium tabular-nums">
                  {computedCost != null
                    ? formatPrice(computedCost, currency)
                    : "—"}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Ganancia (calc.)</span>
                <span
                  className={`font-medium tabular-nums ${
                    computedProfit != null && computedProfit < 0
                      ? "text-destructive"
                      : ""
                  }`}
                >
                  {isMensual
                    ? "—"
                    : computedProfit != null
                      ? formatPrice(computedProfit, currency)
                      : "—"}
                </span>
              </div>
            </div>
          );
        })()}

        <div className="border-t pt-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Estado de pago
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cobrado">
                Cobrado{" "}
                <span className="text-xs text-muted-foreground">
                  (cliente)
                </span>
              </Label>
              <Select
                value={cobrado}
                onValueChange={(v) => v && setCobrado(v as CobradoStatus)}
              >
                <SelectTrigger id="cobrado" className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? COBRADO_LABEL[v as CobradoStatus] : ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COBRADO_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {COBRADO_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pagado">
                Pagado{" "}
                <span className="text-xs text-muted-foreground">(editor)</span>
              </Label>
              <Select
                value={pagado}
                onValueChange={(v) => v && setPagado(v as PagadoStatus)}
              >
                <SelectTrigger id="pagado" className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? PAGADO_LABEL[v as PagadoStatus] : ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAGADO_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PAGADO_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="invoiced">Facturado</Label>
              <Select
                value={invoiced}
                onValueChange={(v) => v && setInvoiced(v as InvoicedStatus)}
              >
                <SelectTrigger id="invoiced" className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? INVOICED_LABEL[v as InvoicedStatus] : ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INVOICED_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {INVOICED_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Guardando…"
            : mode === "create"
              ? "Crear proyecto"
              : "Guardar cambios"}
        </Button>
      </DialogFooter>
    </form>
  );
}
