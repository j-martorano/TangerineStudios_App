"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { getSubClientsForClient } from "@/lib/sub-clients/actions";
import { TemplatePicker } from "./template-picker";
import type { ProjectTemplate } from "@/lib/projects/types";

/**
 * Mantenemos el tipo por compatibilidad con los componentes que ya lo
 * importan, pero ya no se usa: el form rearmó el flujo y los shorts se
 * crean directamente dentro del pack en vez de elegir padre desde una lista.
 */
export type ParentOption = {
  id: string;
  title: string;
  client_id: string | null;
};

type Props = {
  mode: "create" | "edit";
  editors: EditorMini[];
  clients: ClientForProject[];
  /** @deprecated Ya no se usa — quedó para no romper props existentes. */
  availableParents?: ParentOption[];
  project?: ProjectWithRelations;
  initialPhase?: ProjectPhase;
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
  initialPhase,
  onSuccess,
}: Props) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [projectType, setProjectType] = useState<ProjectType>(
    project?.project_type ?? "long_form"
  );
  // Los hijos del pack: pre-cargados desde los hijos existentes al editar.
  // "pack" queda excluido — los hijos no pueden ser packs a su vez.
  type ChildType = Exclude<ProjectType, "pack">;
  type Child = { id?: string; title: string; project_type: ChildType };
  // Cada sección agrupa los proyectos de un subcliente dentro del pack.
  type PackSection = { subClient: string; newDraft: string; children: Child[] };

  function buildInitialSections(): PackSection[] {
    const raw = project?.children ?? [];
    if (raw.length === 0) return [];
    const map = new Map<string, Child[]>();
    for (const c of raw) {
      const key = c.sub_client ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({
        id: c.id,
        title: c.title,
        project_type: (c.project_type === "pack" ? "long_form" : c.project_type) as ChildType,
      });
    }
    return Array.from(map.entries()).map(([subClient, children]) => ({
      subClient,
      newDraft: "",
      children,
    }));
  }

  const [sections, setSections] = useState<PackSection[]>(buildInitialSections);
  const lastChildType = useRef<ChildType>("short_form");
  // Subclientas disponibles para el cliente seleccionado (cargadas desde DB)
  const [subClientOptions, setSubClientOptions] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState<string | null>(
    project?.client?.id ?? null
  );
  const [phase, setPhase] = useState<ProjectPhase>(
    project?.phase ?? initialPhase ?? "por_asignar"
  );
  // Fecha de terminado: mostrada cuando phase === "terminado"
  const [finalizedAt, setFinalizedAt] = useState<string>(
    project?.finalized_at ? project.finalized_at.slice(0, 10) : ""
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
  const initDur = project?.duration_minutes != null
    ? (() => { const t = Math.round(project.duration_minutes! * 60); return { mm: Math.floor(t / 60), ss: t % 60 }; })()
    : null;
  const [durMm, setDurMm] = useState<string>(initDur != null ? String(initDur.mm) : "");
  const [durSs, setDurSs] = useState<string>(initDur != null ? String(initDur.ss) : "");
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

  // El proyecto en edición ES hijo de un pack (no podemos volverlo pack
  // padre — un short hijo no puede tener a su vez hijos).
  const isChildOfPack = project?.parent_id != null;

  // Cargar subclientas del cliente seleccionado
  useEffect(() => {
    if (!clientId) { setSubClientOptions([]); return; }
    getSubClientsForClient(clientId).then(setSubClientOptions);
  }, [clientId]);

  // ── Template picker ────────────────────────────────────────────────────────

  function applyTemplate(t: ProjectTemplate) {
    setProjectType(t.project_type);
    setPhase(t.phase);
    setManualPrice(t.price != null ? String(t.price) : "");
    setManualCost(t.cost != null ? String(t.cost) : "");
    if (t.duration_minutes != null) {
      const totalSec = Math.round(t.duration_minutes * 60);
      setDurMm(String(Math.floor(totalSec / 60)));
      setDurSs(String(totalSec % 60));
    } else {
      setDurMm("");
      setDurSs("");
    }
    // Pre-fill title only if still empty
    if (!title.trim()) setTitle(t.name);
    toast.success(`Plantilla «${t.name}» aplicada`);
  }


  // ── Funciones de secciones del pack ───────────────────────────────────────

  function addSection() {
    setSections((prev) => [...prev, { subClient: "", newDraft: "", children: [] }]);
  }

  function removeSection(sIdx: number) {
    setSections((prev) => prev.filter((_, i) => i !== sIdx));
  }

  function setSectionSubClient(sIdx: number, value: string) {
    setSections((prev) =>
      prev.map((s, i) => (i === sIdx ? { ...s, subClient: value } : s))
    );
  }

  function setSectionDraft(sIdx: number, value: string) {
    setSections((prev) =>
      prev.map((s, i) => (i === sIdx ? { ...s, newDraft: value } : s))
    );
  }

  function addChildToSection(sIdx: number) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sIdx) return s;
        const t = s.newDraft.trim();
        if (t.length === 0) return s;
        return {
          ...s,
          newDraft: "",
          children: [...s.children, { title: t, project_type: lastChildType.current }],
        };
      })
    );
  }

  function removeChild(sIdx: number, cIdx: number) {
    setSections((prev) =>
      prev.map((s, i) =>
        i !== sIdx ? s : { ...s, children: s.children.filter((_, j) => j !== cIdx) }
      )
    );
  }

  function renameChild(sIdx: number, cIdx: number, value: string) {
    setSections((prev) =>
      prev.map((s, i) =>
        i !== sIdx
          ? s
          : {
              ...s,
              children: s.children.map((c, j) => (j === cIdx ? { ...c, title: value } : c)),
            }
      )
    );
  }

  function changeChildType(sIdx: number, cIdx: number, type: ChildType) {
    lastChildType.current = type;
    setSections((prev) =>
      prev.map((s, i) =>
        i !== sIdx
          ? s
          : {
              ...s,
              children: s.children.map((c, j) =>
                j === cIdx ? { ...c, project_type: type } : c
              ),
            }
      )
    );
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

    const mmNum = durMm === "" ? null : parseInt(durMm, 10);
    const ssNum = durSs === "" ? null : parseInt(durSs, 10);
    if ((mmNum !== null && isNaN(mmNum)) || (ssNum !== null && (isNaN(ssNum) || ssNum > 59))) {
      toast.error("Duración inválida");
      return;
    }
    const parsedDuration = (mmNum == null && ssNum == null)
      ? null
      : (mmNum ?? 0) + (ssNum ?? 0) / 60;

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
    const finalPrice = isChildOfPack ? null : priceToStore;

    // Children del pack: solo se mandan si el tipo es "pack". Si cambiás el
    // tipo a otro, el action interpreta la lista vacía como "borrar todos los hijos".
    const childrenPayload =
      projectType === "pack"
        ? sections.flatMap((sec) =>
            sec.children
              .map((c) => ({
                id: c.id,
                title: c.title.trim(),
                project_type: c.project_type,
                sub_client: sec.subClient.trim() || null,
              }))
              .filter((c) => c.title.length > 0)
          )
        : [];

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
      parent_id: project?.parent_id ?? null,
      children: childrenPayload,
      finalized_at: phase === "terminado" ? (finalizedAt || null) : null,
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
  const _mm = durMm === "" ? null : parseInt(durMm, 10);
  const _ss = durSs === "" ? null : parseInt(durSs, 10);
  const parsedDur = (_mm == null && _ss == null) ? null : (_mm ?? 0) + (_ss ?? 0) / 60;
  const validDur = parsedDur != null && !isNaN(parsedDur) && parsedDur > 0 ? parsedDur : null;
  const templateCurrentConfig = {
    project_type: projectType,
    phase,
    price: manualPrice ? parseFloat(manualPrice) : null,
    cost: manualCost ? parseFloat(manualCost) : null,
    duration_minutes: validDur,
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1 lg:max-h-[80vh]">
        {mode === "create" ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Plantilla
            </span>
            <TemplatePicker
              onApply={applyTemplate}
              currentConfig={templateCurrentConfig}
            />
          </div>
        ) : null}

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

        {/* Desktop: 2 columnas — izquierda: tipo/fase/duración; derecha: cliente/financiero */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">

          {/* Columna izquierda */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project_type">Tipo</Label>
              <Select
                value={projectType}
                onValueChange={(v) => {
                  if (!v) return;
                  const next = v as ProjectType;
                  if (projectType === "pack" && next !== "pack") {
                    setSections([]);
                  }
                  setProjectType(next);
                }}
              >
                <SelectTrigger id="project_type" className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? PROJECT_TYPE_LABEL[v as ProjectType] : ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES
                    .filter((t) => !isChildOfPack || t !== "pack")
                    .map((t) => (
                      <SelectItem key={t} value={t}>
                        {PROJECT_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {isChildOfPack && (
                <p className="text-xs text-muted-foreground">
                  Los proyectos hijo de un pack no pueden ser pack a su vez.
                </p>
              )}
            </div>

            {!isChildOfPack && projectType === "pack" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Proyectos del pack
                </p>

                {/* datalist compartido con opciones de la DB + nuevas escritas en otras secciones */}
                <datalist id="subclients-datalist">
                  {Array.from(
                    new Set([
                      ...subClientOptions.map((sc) => sc.name),
                      ...sections.map((s) => s.subClient).filter(Boolean),
                    ])
                  ).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>

                {sections.map((sec, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5"
                  >
                    {/* Header de la sección: subcliente + quitar sección */}
                    <div className="flex items-center gap-2">
                      <Input
                        value={sec.subClient}
                        onChange={(e) => setSectionSubClient(sIdx, e.target.value)}
                        placeholder="Subcliente (opcional)"
                        list="subclients-datalist"
                        className="flex-1 text-sm font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => removeSection(sIdx)}
                        aria-label="Quitar sección"
                        className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                      >
                        ×
                      </button>
                    </div>

                    {/* Proyectos de la sección */}
                    <div className="flex flex-col gap-1.5 pl-1">
                      {sec.children.map((c, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-2">
                          <span className="shrink-0 text-muted-foreground/60">↳</span>
                          <select
                            value={c.project_type}
                            onChange={(e) =>
                              changeChildType(sIdx, cIdx, e.target.value as ChildType)
                            }
                            className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                            aria-label="Tipo del proyecto hijo"
                          >
                            {PROJECT_TYPES.filter((t) => t !== "pack").map((t) => (
                              <option key={t} value={t}>
                                {PROJECT_TYPE_LABEL[t]}
                              </option>
                            ))}
                          </select>
                          <Input
                            value={c.title}
                            onChange={(e) => renameChild(sIdx, cIdx, e.target.value)}
                            placeholder={`Proyecto #${cIdx + 1}`}
                            className="flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => removeChild(sIdx, cIdx)}
                            aria-label="Quitar proyecto"
                            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      {/* Input para agregar proyecto a esta sección */}
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground/60">+</span>
                        <Input
                          value={sec.newDraft}
                          onChange={(e) => setSectionDraft(sIdx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addChildToSection(sIdx);
                            }
                          }}
                          placeholder="Nombre del proyecto (Enter para agregar)"
                          className="flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => addChildToSection(sIdx)}
                          disabled={sec.newDraft.trim().length === 0}
                          className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Botón para agregar una nueva sección */}
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex items-center gap-1.5 self-start rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
                >
                  <PlusIcon className="size-3.5" />
                  Agregar sección de proyectos
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="phase">Fase</Label>
                <Select
                  value={phase}
                  onValueChange={(v) => {
                    if (!v) return;
                    const next = v as ProjectPhase;
                    setPhase(next);
                    if (next === "terminado" && !finalizedAt) {
                      setFinalizedAt(new Date().toISOString().slice(0, 10));
                    }
                  }}
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
                <Label>
                  Duración{" "}
                  <span className="text-xs text-muted-foreground">(min : seg)</span>
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={durMm}
                    onChange={(e) => setDurMm(e.target.value)}
                    placeholder="0"
                    aria-label="Minutos"
                    className="w-20 text-center tabular-nums"
                  />
                  <span className="text-muted-foreground select-none font-medium">:</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    value={durSs}
                    onChange={(e) => setDurSs(e.target.value)}
                    placeholder="00"
                    aria-label="Segundos"
                    className="w-20 text-center tabular-nums"
                  />
                </div>
              </div>
            </div>

            {phase === "terminado" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="finalized_at">Fecha de terminado</Label>
                <Input
                  id="finalized_at"
                  type="date"
                  value={finalizedAt}
                  onChange={(e) => setFinalizedAt(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
                <p className="text-xs text-muted-foreground">
                  Determina en qué mes aparece en el log del kanban. Se
                  autocompleta con la fecha de hoy si la dejás vacía.
                </p>
              </div>
            ) : null}
          </div>

          {/* Columna derecha */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>Cliente</Label>
              <ClientCombobox
                clients={clients}
                value={clientId}
                onChange={(id) => {
                  setClientId(id);
                  if (mode === "create" && id) {
                    const client = clients.find((c) => c.id === id);
                    if (client && client.editors.length > 0) {
                      setEditorEntries(
                        client.editors.map((e) => ({ id: e.id, costDraft: "" }))
                      );
                    }
                  }
                }}
              />
              {isChildOfPack ? (
                <p className="text-xs text-muted-foreground">
                  Este proyecto pertenece a un pack — el cliente lo hereda del pack
                  padre.
                </p>
              ) : null}
            </div>

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

        {/* Desktop: cost total y preview de ganancias lado a lado */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
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
        </div>

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
