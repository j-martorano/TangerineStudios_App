"use client";

import { useState, useTransition } from "react";
import { PlusIcon, XIcon } from "lucide-react";
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
  INVOICED_STATUSES,
  PAGADO_STATUSES,
  PROJECT_PHASES,
} from "@/lib/projects/types";
import type {
  ClientForProject,
  CobradoStatus,
  EditorMini,
  InvoicedStatus,
  PagadoStatus,
  ProjectPhase,
  ProjectWithRelations,
} from "@/lib/projects/types";
import {
  COBRADO_LABEL,
  INVOICED_LABEL,
  PAGADO_LABEL,
  PHASE_LABEL,
  computeCost,
  computePrice,
  computeProfit,
  formatPrice,
} from "@/lib/projects/format";
import { createProject, updateProject } from "@/lib/projects/actions";

type Props = {
  mode: "create" | "edit";
  editors: EditorMini[];
  clients: ClientForProject[];
  project?: ProjectWithRelations;
  onSuccess?: () => void;
};

// Minutos como número legible ("45 min", "−5 min"). A diferencia de
// formatDuration, no colapsa negativos a "—".
function fmtMin(n: number): string {
  const rounded = Number.isInteger(n) ? n : Number(n.toFixed(1));
  return `${rounded} min`;
}

export function ProjectForm({
  mode,
  editors,
  clients,
  project,
  onSuccess,
}: Props) {
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
  const [durationMinutes, setDurationMinutes] = useState<string>(
    project?.duration_minutes != null ? String(project.duration_minutes) : ""
  );
  const [editorIds, setEditorIds] = useState<string[]>(
    () =>
      project?.editors
        ?.map((e) => e.editor?.id)
        .filter((id): id is string => Boolean(id)) ?? []
  );
  const [pending, startTransition] = useTransition();

  const editorById = new Map(editors.map((ed) => [ed.id, ed.name]));

  function addEditor() {
    const next = editors.find((ed) => !editorIds.includes(ed.id));
    if (next) setEditorIds([...editorIds, next.id]);
  }

  function changeEditor(index: number, id: string) {
    setEditorIds(editorIds.map((eid, i) => (i === index ? id : eid)));
  }

  function removeEditor(index: number) {
    setEditorIds(editorIds.filter((_, i) => i !== index));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      toast.error("El título es obligatorio");
      return;
    }

    const parsedPrice = manualPrice === "" ? null : Number(manualPrice);
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

    // El precio sólo se guarda cuando el cliente es 'por_proyecto' (manual).
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
      duration_minutes: parsedDuration,
      editor_ids: editorIds,
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

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;
  const parsedDur = durationMinutes === "" ? null : Number(durationMinutes);
  const validDur =
    parsedDur != null && !Number.isNaN(parsedDur) && parsedDur > 0
      ? parsedDur
      : null;

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

        {/* Saldo de minutos del cliente mensual. */}
        {selectedClient?.payment_type === "mensual" ? (
          <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs">
            {selectedClient.minute_balance != null ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    Saldo de minutos del cliente
                  </span>
                  <span
                    className={`font-medium tabular-nums ${
                      selectedClient.minute_balance < 0
                        ? "text-destructive"
                        : ""
                    }`}
                  >
                    {fmtMin(selectedClient.minute_balance)}
                  </span>
                </div>
                {mode === "create" && validDur != null ? (
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Quedaría tras este video ({fmtMin(validDur)})
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        selectedClient.minute_balance - validDur < 0
                          ? "text-destructive"
                          : ""
                      }`}
                    >
                      {fmtMin(selectedClient.minute_balance - validDur)}
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">
                Sin saldo cargado. Registrá pagos del cliente para acreditar
                minutos.
              </span>
            )}
          </div>
        ) : null}

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

          {selectedClient?.payment_type === "por_proyecto" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="price">
                Precio{" "}
                <span className="text-xs text-muted-foreground">
                  (manual, USD)
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
          ) : null}
        </div>

        {/* Editores — sin límite de cantidad. */}
        <div className="flex flex-col gap-2">
          <Label>Editores</Label>
          {editorIds.length > 0 ? (
            <div className="flex flex-col gap-2">
              {editorIds.map((eid, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={eid}
                    onValueChange={(v) => v && changeEditor(i, v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string | null) =>
                          v ? (editorById.get(v) ?? "—") : "—"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {editors
                        .filter(
                          (ed) => ed.id === eid || !editorIds.includes(ed.id)
                        )
                        .map((ed) => (
                          <SelectItem key={ed.id} value={ed.id}>
                            {ed.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeEditor(i)}
                    aria-label="Quitar editor"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Sin editores asignados.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEditor}
            disabled={editors.length === 0 || editorIds.length >= editors.length}
            className="w-fit"
          >
            <PlusIcon className="size-4" />
            Agregar editor
          </Button>
        </div>

        {/* Preview de precio / costo / ganancia. */}
        {(() => {
          const parsedPrice =
            manualPrice === "" ? null : Number(manualPrice);
          const editorEntries = editorIds
            .map((id) => editors.find((ed) => ed.id === id) ?? null)
            .filter((ed): ed is EditorMini => ed != null)
            .map((ed) => ({ cost: null, editor: ed }));
          const preview = {
            duration_minutes: validDur,
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
                      ? formatPrice(computedPrice)
                      : "—"}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Costo (calc.)</span>
                <span className="font-medium tabular-nums">
                  {computedCost != null ? formatPrice(computedCost) : "—"}
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
                      ? formatPrice(computedProfit)
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
