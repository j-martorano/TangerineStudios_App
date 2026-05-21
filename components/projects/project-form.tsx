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
  PROJECT_TYPES,
  PROJECT_TYPE_LABEL,
} from "@/lib/projects/types";
import type {
  ClientForProject,
  CobradoStatus,
  EditorMini,
  InvoicedStatus,
  PagadoStatus,
  ProjectPhase,
  ProjectType,
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

export type ParentOption = {
  id: string;
  title: string;
  client_id: string | null;
};

type Props = {
  mode: "create" | "edit";
  editors: EditorMini[];
  clients: ClientForProject[];
  /** Proyectos top-level que pueden ser pack padre del actual. */
  availableParents?: ParentOption[];
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
  availableParents = [],
  project,
  onSuccess,
}: Props) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [projectType, setProjectType] = useState<ProjectType>(
    project?.project_type ?? "long_form"
  );
  const [parentId, setParentId] = useState<string | null>(
    project?.parent_id ?? null
  );
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
  const [manualCost, setManualCost] = useState<string>(
    project?.cost != null ? String(project.cost) : ""
  );
  type EditorEntry = { id: string; costDraft: string };
  const [editorEntries, setEditorEntries] = useState<EditorEntry[]>(
    () =>
      project?.editors
        ?.filter((e) => e.editor != null)
        .map((e) => ({
          id: e.editor!.id,
          costDraft: e.cost != null ? String(e.cost) : "",
        })) ?? []
  );
  const [pending, startTransition] = useTransition();

  const editorById = new Map(editors.map((ed) => [ed.id, ed.name]));
  const editorIds = editorEntries.map((e) => e.id);

  // Padres elegibles: top-level, no archivados, no el propio proyecto, y
  // del mismo cliente si ya hay uno seleccionado.
  const eligibleParents = availableParents.filter((parent) => {
    if (project && parent.id === project.id) return false;
    if (clientId && parent.client_id && parent.client_id !== clientId)
      return false;
    return true;
  });

  function handleParentChange(newParentId: string | null) {
    setParentId(newParentId);
    if (newParentId) {
      const parent = availableParents.find((p) => p.id === newParentId);
      if (parent?.client_id) setClientId(parent.client_id);
    }
  }

  function addEditor() {
    const next = editors.find((ed) => !editorIds.includes(ed.id));
    if (next)
      setEditorEntries([...editorEntries, { id: next.id, costDraft: "" }]);
  }

  function changeEditor(index: number, id: string) {
    setEditorEntries(
      editorEntries.map((e, i) => (i === index ? { ...e, id } : e))
    );
  }

  function changeEditorCost(index: number, costDraft: string) {
    setEditorEntries(
      editorEntries.map((e, i) => (i === index ? { ...e, costDraft } : e))
    );
  }

  function removeEditor(index: number) {
    setEditorEntries(editorEntries.filter((_, i) => i !== index));
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

    const parsedCost = manualCost === "" ? null : Number(manualCost);
    if (parsedCost !== null && (Number.isNaN(parsedCost) || parsedCost < 0)) {
      toast.error("Cost total inválido");
      return;
    }

    const editorPayload: { id: string; cost: number | null }[] = [];
    for (const entry of editorEntries) {
      const costStr = entry.costDraft.trim();
      let cost: number | null = null;
      if (costStr !== "") {
        const n = Number(costStr);
        if (Number.isNaN(n) || n < 0) {
          toast.error(
            `Costo manual inválido para ${editorById.get(entry.id) ?? "editor"}`
          );
          return;
        }
        cost = n;
      }
      editorPayload.push({ id: entry.id, cost });
    }

    // El precio sólo se guarda cuando el cliente es 'por_proyecto' (manual).
    const selectedClient = clients.find((c) => c.id === clientId) ?? null;
    const priceToStore =
      selectedClient?.payment_type === "por_proyecto" ? parsedPrice : null;

    // Si es hijo de un pack, el precio queda nulo (lo lleva el pack).
    const finalPrice = parentId ? null : priceToStore;

    const payload = {
      title: trimmedTitle,
      client_id: clientId,
      phase,
      cobrado,
      pagado,
      invoiced,
      price: finalPrice,
      cost: parsedCost,
      duration_minutes: parsedDuration,
      editors: editorPayload,
      project_type: projectType,
      parent_id: parentId,
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project_type">Tipo</Label>
            <Select
              value={projectType}
              onValueChange={(v) => v && setProjectType(v as ProjectType)}
            >
              <SelectTrigger id="project_type" className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v ? PROJECT_TYPE_LABEL[v as ProjectType] : ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PROJECT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="parent_pack">
              Pack padre{" "}
              <span className="text-xs text-muted-foreground">
                (opcional, lo hace un short hijo)
              </span>
            </Label>
            <Select
              value={parentId ?? "__none__"}
              onValueChange={(v) =>
                handleParentChange(v === "__none__" ? null : v)
              }
              disabled={eligibleParents.length === 0}
            >
              <SelectTrigger id="parent_pack" className="w-full">
                <SelectValue>
                  {(v: string | null) => {
                    if (!v || v === "__none__") return "Sin pack (proyecto suelto)";
                    return (
                      availableParents.find((p) => p.id === v)?.title ?? "—"
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  Sin pack (proyecto suelto)
                </SelectItem>
                {eligibleParents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Cliente</Label>
          <ClientCombobox
            clients={clients}
            value={clientId}
            onChange={(id) => setClientId(id)}
          />
          {parentId ? (
            <p className="text-xs text-muted-foreground">
              El cliente queda fijado al del pack padre.
            </p>
          ) : null}
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
          {editorEntries.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_140px_auto] gap-2 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Editor</span>
                <span>Costo manual (USD)</span>
                <span className="w-8" />
              </div>
              {editorEntries.map((entry, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_140px_auto] items-center gap-2"
                >
                  <Select
                    value={entry.id}
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
                          (ed) =>
                            ed.id === entry.id || !editorIds.includes(ed.id)
                        )
                        .map((ed) => (
                          <SelectItem key={ed.id} value={ed.id}>
                            {ed.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={entry.costDraft}
                    onChange={(e) => changeEditorCost(i, e.target.value)}
                    placeholder="auto"
                    className="h-9 text-right tabular-nums"
                    aria-label={`Costo manual del editor ${i + 1}`}
                  />
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
              <p className="text-xs text-muted-foreground">
                Dejá el costo vacío para usar el cálculo automático del modelo
                de pago del editor.
              </p>
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

        {/* Cost total del proyecto — override opcional que sobrescribe la
            suma calculada de los editores. */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="manual_cost">
            Cost total del proyecto{" "}
            <span className="text-xs text-muted-foreground">
              (override opcional, USD)
            </span>
          </Label>
          <Input
            id="manual_cost"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={manualCost}
            onChange={(e) => setManualCost(e.target.value)}
            placeholder="Vacío = se calcula desde los editores"
          />
          <p className="text-xs text-muted-foreground">
            Si cargás un monto, sobrescribe la suma calculada de los costos
            por editor. Útil para casos especiales que no encajan en ningún
            modelo.
          </p>
        </div>

        {/* Preview de precio / costo / ganancia. */}
        {(() => {
          const parsedPrice =
            manualPrice === "" ? null : Number(manualPrice);
          const parsedManualCost =
            manualCost === "" ? null : Number(manualCost);
          const previewEditors = editorEntries
            .map((entry) => {
              const editor = editors.find((ed) => ed.id === entry.id) ?? null;
              if (!editor) return null;
              const costStr = entry.costDraft.trim();
              const cost =
                costStr === ""
                  ? null
                  : Number.isNaN(Number(costStr))
                    ? null
                    : Number(costStr);
              return { cost, editor };
            })
            .filter((e): e is { cost: number | null; editor: EditorMini } =>
              e != null
            );
          const preview = {
            cost:
              parsedManualCost != null && !Number.isNaN(parsedManualCost)
                ? parsedManualCost
                : null,
            duration_minutes: validDur,
            price:
              selectedClient?.payment_type === "por_proyecto" &&
              parsedPrice != null &&
              !Number.isNaN(parsedPrice)
                ? parsedPrice
                : null,
            client: selectedClient,
            editors: previewEditors,
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
                    ? "RETAINER"
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
