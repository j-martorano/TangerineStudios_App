"use client";

import Link from "next/link";
import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRightIcon, ChevronDownIcon, PackageIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import type { ClientForInvoice } from "@/lib/invoices/types";

import { KanbanCardActions } from "./kanban-card-actions";
import { ProjectForm, type ParentOption } from "./project-form";
import { QuickDurationEditor } from "./quick-duration-editor";

import {
  PROJECT_PHASES,
  isPack,
} from "@/lib/projects/types";
import {
  CARD_CHIP_BASE,
  CARD_CLIENT_CHIP_BASE,
  CARD_TYPE_CHIP,
  CARD_TYPE_CHIP_BASE,
  CARD_TYPE_INITIAL,
} from "./kanban-card-styles";
import { QuickPaymentBadge } from "./quick-payment-badge";
import { contrastColor } from "@/lib/clients/palette";
import type {
  ClientForProject,
  EditorMini,
  ProjectPhase,
  ProjectWithRelations,
} from "@/lib/projects/types";
import {
  PHASE_LABEL,
  computeCost,
  computePrice,
} from "@/lib/projects/format";
import { reorderProjects, type ReorderUpdate } from "@/lib/projects/actions";
import type { RetainerPayment } from "@/lib/finanzas/queries";
import { todayAR, currentMonthKeyAR } from "@/lib/argentina-date";

type Props = {
  projects: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  clientsForInvoice?: ClientForInvoice[];
  availableParents?: ParentOption[];
  /** ID del proyecto a resaltar (viene del param ?focus=ID del link de Discord) */
  highlightId?: string;
  retainerPayments?: RetainerPayment[];
};

type ColumnsMap = Record<ProjectPhase, ProjectWithRelations[]>;

type PendingFinalize = {
  projectId: string;
  existingFinalizedAt: string;
  rollbackCols: ColumnsMap;
  baseUpdates: ReorderUpdate[];
};

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function monthKey(iso: string | null | undefined): string {
  if (!iso) return "0000-00";
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const name = MONTH_NAMES[Number(month) - 1] ?? "Sin fecha";
  return year === "0000" ? "Sin fecha" : `${name} ${year}`;
}

/** Para proyectos no-retainer cobrados: devuelve el mes del cobro más reciente.
 *  Para los demás (retainer o no cobrado) devuelve null. */
function getCobradoMK(p: ProjectWithRelations): string | null {
  if (p.cobrado !== "si" || p.client?.payment_type === "mensual") return null;
  const latestCobro = p.cobros.length > 0
    ? p.cobros.reduce((a, b) => (b.paid_at > a.paid_at ? b : a))
    : null;
  if (latestCobro) return latestCobro.paid_at.slice(0, 7);
  // fallback: usar mes natural del proyecto
  return monthKey(p.finalized_at ?? p.created_at);
}

const statCurrencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatStat(value: number): string {
  if (value < 0) return `-${statCurrencyFmt.format(Math.abs(value))}`;
  return statCurrencyFmt.format(value);
}

function groupTerminadoByMonth(
  items: ProjectWithRelations[]
): { key: string; label: string; items: ProjectWithRelations[] }[] {
  const map = new Map<string, ProjectWithRelations[]>();
  for (const p of items) {
    // Prioridad: mes de cobro (no-retainer cobrado) > mes de terminado
    const key = getCobradoMK(p) ?? monthKey(p.finalized_at);
    const arr = map.get(key);
    if (arr) arr.push(p);
    else map.set(key, [p]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, groupItems]) => ({
      key,
      label: monthLabel(key).toUpperCase(),
      items: groupItems,
    }));
}

function todayUTC(): string {
  return todayAR();
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function buildColumns(projects: ProjectWithRelations[], currentMK: string): ColumnsMap {
  const map = {} as ColumnsMap;
  for (const phase of PROJECT_PHASES) map[phase] = [];
  for (const p of projects) {
    // Proyecto no-retainer cobrado en un mes pasado → columna histórica (terminado)
    if (p.phase !== "terminado") {
      const cobradoMK = getCobradoMK(p);
      if (cobradoMK && cobradoMK !== currentMK) {
        map["terminado"].push(p);
        continue;
      }
    }
    map[p.phase].push(p);
  }
  for (const phase of PROJECT_PHASES) {
    map[phase].sort((a, b) => a.position - b.position);
  }
  return map;
}

function findContainer(cols: ColumnsMap, id: string): ProjectPhase | null {
  if ((PROJECT_PHASES as string[]).includes(id)) return id as ProjectPhase;
  if (id.startsWith("hist:")) return "terminado";
  for (const phase of PROJECT_PHASES) {
    if (cols[phase].some((p) => p.id === id)) return phase;
  }
  return null;
}

/** Devuelve el mes histórico (YYYY-MM) si el drop target es una columna o
 *  card de un mes pasado. Devuelve null si es el mes actual o no es terminado. */
function getHistMonthFromDrop(
  overId: string,
  terminadoItems: ProjectWithRelations[],
): string | null {
  if (overId.startsWith("hist:")) return overId.slice(5);
  const overProject = terminadoItems.find((p) => p.id === overId);
  if (!overProject) return null;
  const currentMK = currentMonthKeyAR();
  // Para proyectos cobrados (no-retainer), usar el mes del cobro como referencia
  const projectMK = getCobradoMK(overProject) ?? monthKey(overProject.finalized_at);
  return projectMK !== currentMK && projectMK !== "0000-00" ? projectMK : null;
}

// Detecta droppables usando primero la posición del puntero (fiable para
// columnas vacías) y cae a closestCorners como fallback.
const kanbanCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return closestCorners(args);
};

const PHASE_BLOB: Record<ProjectPhase, string | null> = {
  por_asignar: null,
  editando: "#37ACFF20",
  en_revision: "#FF373720",
  terminado: "#37FF6220",
};

// ─── Context para efecto blur ─────────────────────────────────────────────────
// Cuando una card abre su menú, las otras se blurean.

const KanbanFocusCtx = createContext<{
  menuFocusId: string | null;
  setMenuFocusId: (id: string | null) => void;
  editFocusId: string | null;
  setEditFocusId: (id: string | null) => void;
  dndDisabled: boolean;
  setDndDisabled: (v: boolean) => void;
}>({
  menuFocusId: null, setMenuFocusId: () => {},
  editFocusId: null, setEditFocusId: () => {},
  dndDisabled: false, setDndDisabled: () => {},
});

// ─── Context para highlight desde URL (?focus=ID) ─────────────────────────────
// Cuando se llega desde el link del bot de Discord, se resalta la card.

const KanbanHighlightCtx = createContext<string | null>(null);

const KanbanInvoiceCtx = createContext<{
  onFacturar: (project: ProjectWithRelations) => void;
}>({ onFacturar: () => {} });

// ─── Context para pagos de retainer (stats de columnas) ──────────────────────

const KanbanRetainerPaymentsCtx = createContext<RetainerPayment[]>([]);
const KanbanAllProjectsCtx = createContext<ProjectWithRelations[]>([]);

// ─── Export ───────────────────────────────────────────────────────────────────

export function ProjectsKanban(props: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [menuFocusId, setMenuFocusId] = useState<string | null>(props.highlightId ?? null);
  const [editFocusId, setEditFocusId] = useState<string | null>(null);
  const [dndDisabled, setDndDisabled] = useState(false);
  const [facturarProject, setFacturarProject] = useState<ProjectWithRelations | null>(null);
  useEffect(() => setMounted(true), []);

  // Limpiar el focus del highlight después de 3.5s
  useEffect(() => {
    if (!props.highlightId) return;
    const t = setTimeout(() => setMenuFocusId(null), 3500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selector de mes: "all" | "YYYY-MM"
  const [month, setMonth] = useState<string>("all");

  // Meses disponibles desde created_at Y finalized_at de todos los proyectos
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const p of props.projects) {
      const ck = monthKey(p.created_at);
      if (ck !== "0000-00") set.add(ck);
      if (p.finalized_at) {
        const fk = monthKey(p.finalized_at);
        if (fk !== "0000-00") set.add(fk);
      }
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [props.projects]);

  // Filtro:
  //   - terminado  → solo los finalizados en el mes seleccionado
  //   - resto      → auto-carry: proyectos con created_at ≤ mes seleccionado
  const filtered = useMemo(() => {
    if (month === "all") return props.projects;
    return props.projects.filter((p) => {
      if (p.phase === "terminado") {
        return monthKey(p.finalized_at) === month;
      }
      return monthKey(p.created_at) <= month;
    });
  }, [props.projects, month]);

  const boardProps = {
    projects: filtered,
    editors: props.editors,
    clients: props.clients,
    availableParents: props.availableParents ?? [],
  };

  return (
    <KanbanAllProjectsCtx.Provider value={props.projects}>
    <KanbanRetainerPaymentsCtx.Provider value={props.retainerPayments ?? []}>
    <KanbanHighlightCtx.Provider value={props.highlightId ?? null}>
    <KanbanFocusCtx.Provider value={{ menuFocusId, setMenuFocusId, editFocusId, setEditFocusId, dndDisabled, setDndDisabled }}>
    <KanbanInvoiceCtx.Provider value={{ onFacturar: setFacturarProject }}>
      {/* Modal de nueva factura pre-cargado con el proyecto */}
      {facturarProject ? (
        <Dialog open onOpenChange={(o) => !o && setFacturarProject(null)}>
          <DialogContent className="sm:max-w-[min(50vw,680px)]">
            <DialogHeader>
              <DialogTitle>Nueva factura — {facturarProject.title}</DialogTitle>
            </DialogHeader>
            <InvoiceForm
              projects={props.projects}
              clients={props.clientsForInvoice ?? []}
              initialClientId={facturarProject.client_id ?? undefined}
              initialProjectId={facturarProject.id}
              onSuccess={() => {
                setFacturarProject(null);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      <div className="flex flex-col gap-4">
        {/* Filtro de meses oculto — los meses se muestran como columnas */}
        {false && months.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <MonthTab active={month === "all"} onClick={() => setMonth("all")}>
              Todos
            </MonthTab>
            {months.map((m) => (
              <MonthTab key={m} active={month === m} onClick={() => setMonth(m)}>
                {monthLabel(m)}
              </MonthTab>
            ))}
          </div>
        ) : null}
        {mounted ? (
          <InteractiveKanban {...boardProps} />
        ) : (
          <StaticKanban {...boardProps} />
        )}
      </div>
    </KanbanInvoiceCtx.Provider>
    </KanbanFocusCtx.Provider>
    </KanbanHighlightCtx.Provider>
    </KanbanRetainerPaymentsCtx.Provider>
    </KanbanAllProjectsCtx.Provider>
  );
}

function MonthTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-border bg-accent text-foreground"
          : "border-border/60 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Static (SSR placeholder) ─────────────────────────────────────────────────

function StaticKanban({
  projects,
  editors,
  clients,
  availableParents = [],
}: Props) {
  const currentMKStatic = currentMonthKeyAR();
  const columns = buildColumns(projects, currentMKStatic);
  const terminadoGroups = groupTerminadoByMonth(columns.terminado);
  const currentGroup = terminadoGroups.find((g) => g.key === currentMKStatic) ?? null;
  const historicalGroups = terminadoGroups.filter((g) => g.key !== currentMKStatic);
  const activePhases = (["por_asignar", "editando", "en_revision"] as ProjectPhase[]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {/* Columnas activas */}
      {activePhases.map((phase) => (
        <div key={phase} className="relative flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#1a1a1a] min-h-[70vh]">
          {PHASE_BLOB[phase] ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-48"
              style={{ background: `radial-gradient(ellipse 100% 140px at 50% 0%, ${PHASE_BLOB[phase]}, transparent)` }}
            />
          ) : null}
          <div className="relative flex flex-1 flex-col gap-3 px-[15px] py-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-xl font-[200] uppercase tracking-tight">{PHASE_LABEL[phase]}</span>
              <span className="text-xl font-semibold tabular-nums text-white">{columns[phase].length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {columns[phase].length === 0 ? (
                <p className="px-1 py-4 text-center text-xs italic text-muted-foreground">Sin proyectos</p>
              ) : (
                columns[phase].map((p) => (
                  <div key={p.id} className="flex flex-col">
                    <PackBadge project={p} />
                    <CardView project={p} editors={editors} clients={clients} availableParents={availableParents} />
                  </div>
                ))
              )}
              <KanbanAddButton phase={phase} editors={editors} clients={clients} availableParents={availableParents} />
            </div>
          </div>
        </div>
      ))}

      {/* Columna terminado — mes actual */}
      <div className="relative flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#1a1a1a] min-h-[70vh]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48"
          style={{ background: "radial-gradient(ellipse 100% 140px at 50% 0%, #37FF6220, transparent)" }} />
        <div className="relative flex flex-1 flex-col gap-3 px-[15px] py-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-xl font-[200] uppercase tracking-tight">
              {currentGroup?.label ?? PHASE_LABEL.terminado}
            </span>
            <span className="text-xl font-semibold tabular-nums text-white">
              {currentGroup?.items.length ?? 0}
            </span>
          </div>
          <TerminadoStats items={currentGroup?.items ?? []} mk={currentMKStatic} />
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {!currentGroup || currentGroup.items.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs italic text-muted-foreground">Sin proyectos</p>
            ) : (
              currentGroup.items.map((p) => (
                <div key={p.id} className="flex flex-col">
                  <PackBadge project={p} />
                  <CardView project={p} editors={editors} clients={clients} availableParents={availableParents} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Histórico */}
      {historicalGroups.length > 0 && (
        <>
          <HistoricoDivider />
          {historicalGroups.map((group) => (
            <HistoricalMonthColumn
              key={group.key}
              group={group}
              editors={editors}
              clients={clients}
              availableParents={availableParents}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Interactive (cliente DnD) ────────────────────────────────────────────────

function InteractiveKanban({
  projects,
  editors,
  clients,
  availableParents = [],
}: Props) {
  const { dndDisabled } = useContext(KanbanFocusCtx);

  const [columns, setColumns] = useState<ColumnsMap>(() =>
    buildColumns(projects, currentMonthKeyAR())
  );
  const columnsRef = useRef<ColumnsMap>(columns);
  columnsRef.current = columns;
  const preDragColsRef = useRef<ColumnsMap>(columns);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSourcePhase, setActiveSourcePhase] =
    useState<ProjectPhase | null>(null);
  const [pendingFinalize, setPendingFinalize] =
    useState<PendingFinalize | null>(null);
  const [, startTransition] = useTransition();

  const projectsKey = useMemo(
    () =>
      projects
        .map(
          (p) =>
            `${p.id}:${p.phase}:${p.position}:${p.finalized}:${p.cobrado}:${p.pagado}:${p.invoiced}:${p.cobros.length}:${p.editor_pagos.length}`
        )
        .join("|"),
    [projects]
  );
  const lastKeyRef = useRef(projectsKey);
  useEffect(() => {
    if (lastKeyRef.current === projectsKey) return;
    lastKeyRef.current = projectsKey;
    setColumns(buildColumns(projects, currentMonthKeyAR()));
  }, [projectsKey, projects]);

  const allSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const activeProject = activeId
    ? Object.values(columns)
        .flat()
        .find((p) => p.id === activeId) ?? null
    : null;

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    preDragColsRef.current = columnsRef.current;
    setActiveId(id);
    setActiveSourcePhase(findContainer(columnsRef.current, id));
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    setColumns((prev) => {
      const activeContainer = findContainer(prev, activeIdStr);
      const overContainer = findContainer(prev, overIdStr);
      if (!activeContainer || !overContainer) return prev;

      // Cuando el destino es terminado, determinar el finalized_at temporal
      // para que la card aparezca visualmente en el mes correcto durante el drag.
      const tempFinalizedAt: string | null = (() => {
        if (overContainer !== "terminado") return null;
        if (overIdStr.startsWith("hist:")) return `${overIdStr.slice(5)}-01T12:00:00Z`;
        const overProject = prev.terminado.find((p) => p.id === overIdStr);
        return overProject?.finalized_at ?? `${todayUTC()}T12:00:00Z`;
      })();

      if (activeContainer === overContainer) {
        // Mismo container: solo actualizar finalized_at si cambia de mes histórico
        if (overContainer !== "terminado") return prev;
        const activeItem = prev.terminado.find((p) => p.id === activeIdStr);
        if (!activeItem || activeItem.finalized_at === tempFinalizedAt) return prev;
        return {
          ...prev,
          terminado: prev.terminado.map((p) =>
            p.id === activeIdStr ? { ...p, finalized_at: tempFinalizedAt } : p
          ),
        };
      }

      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((p) => p.id === activeIdStr);
      if (activeIndex === -1) return prev;
      const moving = {
        ...activeItems[activeIndex],
        phase: overContainer,
        finalized_at: overContainer === "terminado" ? tempFinalizedAt : activeItems[activeIndex].finalized_at,
      };

      let overIndex = overItems.findIndex((p) => p.id === overIdStr);
      if (overIndex === -1) overIndex = overItems.length;

      return {
        ...prev,
        [activeContainer]: activeItems.filter((_, i) => i !== activeIndex),
        [overContainer]: [
          ...overItems.slice(0, overIndex),
          moving,
          ...overItems.slice(overIndex),
        ],
      };
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const sourcePhase = activeSourcePhase;
    setActiveId(null);
    setActiveSourcePhase(null);

    const { active, over } = e;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const prevCols = columnsRef.current;

    const activeContainer = findContainer(prevCols, activeIdStr);
    const overContainer = findContainer(prevCols, overIdStr);
    if (!activeContainer || !overContainer) return;

    let next = prevCols;

    // Reorden dentro de la misma columna
    if (activeContainer === overContainer) {
      const items = prevCols[activeContainer];
      const activeIndex = items.findIndex((p) => p.id === activeIdStr);
      const overIndex = items.findIndex((p) => p.id === overIdStr);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        next = {
          ...prevCols,
          [activeContainer]: arrayMove(items, activeIndex, overIndex),
        };
        setColumns(next);
      }
    }

    // Construir updates para la DB
    const updates: ReorderUpdate[] = [];
    const affected = new Set([activeContainer, overContainer]);
    for (const phase of affected) {
      next[phase].forEach((p, idx) => {
        const u: ReorderUpdate = { id: p.id, phase, position: idx };
        // Movido DESDE terminado → activo
        if (
          p.id === activeIdStr &&
          phase !== "terminado" &&
          sourcePhase === "terminado"
        ) {
          u.finalized = false;
          u.finalized_at = null;
        }
        updates.push(u);
      });
    }

    // Drop en terminado: historial o mes actual
    if (overContainer === "terminado") {
      const histMonth = getHistMonthFromDrop(overIdStr, next.terminado);

      if (histMonth) {
        // Mes histórico: actualizar finalized_at sin dialog (funciona también al
        // reubicar un proyecto ya terminado entre meses históricos).
        const finalUpdates = updates.map((u) =>
          u.id === activeIdStr
            ? { ...u, phase: "terminado" as ProjectPhase, finalized: true, finalized_at: `${histMonth}-01T12:00:00Z`, movePaidAtTo: `${histMonth}-15` }
            : u
        );
        startTransition(async () => {
          const result = await reorderProjects(finalUpdates);
          if (!result.ok) toast.error(result.error);
        });
        return;
      }

      // Drag desde fase activa hacia terminado del mes actual
      if (sourcePhase !== "terminado") {
        const original = projects.find((p) => p.id === activeIdStr);
        const existingDate = original?.finalized_at
          ? original.finalized_at.slice(0, 10)
          : null;
        const today = todayUTC();

        if (existingDate && existingDate !== today) {
          const baseUpdates = updates.map((u) =>
            u.id === activeIdStr ? { ...u, finalized: true } : u
          );
          setPendingFinalize({
            projectId: activeIdStr,
            existingFinalizedAt: original!.finalized_at!,
            rollbackCols: preDragColsRef.current,
            baseUpdates,
          });
          return;
        }

        const finalUpdates = updates.map((u) =>
          u.id === activeIdStr
            ? { ...u, finalized: true, finalized_at: `${today}T12:00:00Z` }
            : u
        );
        startTransition(async () => {
          const result = await reorderProjects(finalUpdates);
          if (!result.ok) toast.error(result.error);
        });
        return;
      }

      // Drag desde terminado histórico → terminado mes actual
      if (sourcePhase === "terminado") {
        const today = todayUTC();
        const finalUpdates = updates.map((u) =>
          u.id === activeIdStr
            ? { ...u, finalized: true, finalized_at: `${today}T12:00:00Z`, movePaidAtTo: today }
            : u
        );
        startTransition(async () => {
          const result = await reorderProjects(finalUpdates);
          if (!result.ok) toast.error(result.error);
        });
        return;
      }
    }

    if (updates.length > 0) {
      startTransition(async () => {
        const result = await reorderProjects(updates);
        if (!result.ok) toast.error(result.error);
      });
    }
  }

  function handleUsarHoy() {
    if (!pendingFinalize) return;
    const { projectId, baseUpdates } = pendingFinalize;
    const today = todayUTC();
    const finalUpdates = baseUpdates.map((u) =>
      u.id === projectId
        ? { ...u, phase: "terminado" as ProjectPhase, finalized: true, finalized_at: `${today}T12:00:00Z` }
        : u
    );
    startTransition(async () => {
      const result = await reorderProjects(finalUpdates);
      if (!result.ok) toast.error(result.error);
    });
    setPendingFinalize(null);
  }

  function handleMantenerFecha() {
    if (!pendingFinalize) return;
    const { projectId, existingFinalizedAt, baseUpdates } = pendingFinalize;
    const finalUpdates = baseUpdates.map((u) =>
      u.id === projectId
        ? { ...u, phase: "terminado" as ProjectPhase, finalized: true, finalized_at: existingFinalizedAt }
        : u
    );
    startTransition(async () => {
      const result = await reorderProjects(finalUpdates);
      if (!result.ok) toast.error(result.error);
    });
    setPendingFinalize(null);
  }

  function handleCancelarFinalize() {
    if (!pendingFinalize) return;
    setColumns(pendingFinalize.rollbackCols);
    setPendingFinalize(null);
  }

  return (
    <>
      <DndContext
        sensors={dndDisabled ? [] : allSensors}
        collisionDetection={kanbanCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setActiveSourcePhase(null);
        }}
      >
        {(() => {
          const terminadoGroups = groupTerminadoByMonth(columns.terminado);
          const currentMK = currentMonthKeyAR();
          const currentGroup = terminadoGroups.find((g) => g.key === currentMK) ?? null;
          const historicalGroups = terminadoGroups.filter((g) => g.key !== currentMK);
          const activePhases = (["por_asignar", "editando", "en_revision"] as ProjectPhase[]);
          return (
            <div className="flex gap-3 overflow-x-auto pb-3">
              {activePhases.map((phase) => (
                <KanbanColumn
                  key={phase}
                  phase={phase}
                  items={columns[phase]}
                  editors={editors}
                  clients={clients}
                  availableParents={availableParents}
                />
              ))}
              <KanbanColumn
                phase="terminado"
                items={currentGroup?.items ?? []}
                monthLabel={currentGroup?.label}
                mk={currentMK}
                editors={editors}
                clients={clients}
                availableParents={availableParents}
              />
              {historicalGroups.length > 0 && (
                <>
                  <HistoricoDivider />
                  {historicalGroups.map((group) => (
                    <DroppableHistoricalMonthColumn
                      key={group.key}
                      group={group}
                      editors={editors}
                      clients={clients}
                      availableParents={availableParents}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })()}
        <DragOverlay>
          {activeProject ? (
            <CardView project={activeProject} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {pendingFinalize ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) handleCancelarFinalize();
          }}
        >
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Actualizar fecha de terminado?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Este proyecto ya fue terminado el{" "}
                <strong>
                  {formatShortDate(pendingFinalize.existingFinalizedAt)}
                </strong>
                . ¿Querés guardar la fecha de hoy o mantener la anterior?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:flex-wrap sm:justify-end">
              <AlertDialogCancel onClick={handleCancelarFinalize}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleMantenerFecha}
                className="bg-muted text-foreground hover:bg-muted/80"
              >
                Mantener ({formatShortDate(pendingFinalize.existingFinalizedAt)})
              </AlertDialogAction>
              <AlertDialogAction onClick={handleUsarHoy}>
                Usar fecha de hoy
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}

// ─── Badge de pack (aparece sobre la card de proyectos tipo pack) ────────────

function PackBadge({ project }: { project: ProjectWithRelations }) {
  if (!isPack(project)) return null;
  return (
    <div className="flex w-fit items-center gap-1 rounded-md border border-border/40 bg-muted/50 px-2 py-0.5">
      <PackageIcon className="size-2.5 shrink-0 text-muted-foreground/60" />
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
        Pack
      </span>
    </div>
  );
}

// ─── Botón agregar a columna ──────────────────────────────────────────────────

function KanbanAddButton({
  phase,
  editors,
  clients,
  availableParents,
}: {
  phase: ProjectPhase;
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents: ParentOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/40 py-2 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-accent/20 hover:text-foreground"
      >
        <PlusIcon className="size-3.5" />
        Agregar
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
          </DialogHeader>
          <ProjectForm
            mode="create"
            editors={editors}
            clients={clients}
            availableParents={availableParents}
            initialPhase={phase}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Stats del terminado ─────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="rounded-[5px] border border-white/[0.08] bg-[#2c2c2c] px-4 py-[10px]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-bold leading-tight ${colorClass}`}>{formatStat(value)}</p>
    </div>
  );
}

function TerminadoStats({ items, mk: mkProp }: { items: ProjectWithRelations[]; mk?: string }) {
  const retainerPayments = useContext(KanbanRetainerPaymentsCtx);
  const allProjects = useContext(KanbanAllProjectsCtx);

  // mkProp se pasa explícitamente para el mes actual (aunque no haya terminados).
  // Fallback: derivar del primer item del grupo histórico.
  const mk = mkProp ?? items[0]?.finalized_at?.slice(0, 7) ?? null;
  if (!mk) return null;

  // Bucket por paid_at del cobro, no por la fecha natural del proyecto.
  // Así un proyecto de julio cobrado en agosto aparece en agosto.
  let total = 0;
  let cost = 0;
  const countedClients = new Set<string>();

  for (const p of allProjects) {
    if (p.parent_id) continue;

    if (p.client?.payment_type === "mensual" && p.client_id) {
      if (!countedClients.has(p.client_id)) {
        const payment = retainerPayments.find(
          (pay) => pay.client_id === p.client_id && pay.paid_at.startsWith(mk)
        );
        if (payment) {
          countedClients.add(p.client_id);
          total += payment.amount;
        }
      }
    } else if (p.cobrado === "si") {
      const latestCobro = p.cobros.length > 0
        ? p.cobros.reduce((a, b) => (b.paid_at > a.paid_at ? b : a))
        : null;
      const cobradoMk = latestCobro?.paid_at.slice(0, 7)
        ?? (p.finalized_at ?? p.created_at)?.slice(0, 7);
      if (cobradoMk === mk) {
        total += computePrice(p) ?? 0;
      }
    }

    // Costo: independiente del cobrado, se bucketa por la fecha del pago al editor
    if (p.pagado === "pago_total" && p.client?.payment_type !== "mensual") {
      const latestPago = p.editor_pagos.length > 0
        ? p.editor_pagos.reduce((a, b) => (b.paid_at > a.paid_at ? b : a))
        : null;
      const pagadoMk = latestPago?.paid_at.slice(0, 7)
        ?? (p.finalized_at ?? p.created_at)?.slice(0, 7);
      if (pagadoMk === mk) {
        cost += computeCost(p) ?? 0;
      }
    }
  }

  const ganancia = total - cost;
  if (total === 0 && cost === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <StatCard label="Total" value={total} colorClass="text-foreground" />
      <StatCard label="Costo" value={cost} colorClass="text-red-500" />
      <StatCard
        label="Ganancia"
        value={ganancia}
        colorClass={ganancia >= 0 ? "text-emerald-500" : "text-red-500"}
      />
    </div>
  );
}

// ─── Divisor histórico ───────────────────────────────────────────────────────

function HistoricoDivider() {
  return (
    <div className="flex w-10 shrink-0 flex-col items-center gap-3 py-[10px]">
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/35 [writing-mode:vertical-rl]">
        Histórico
      </span>
      <div className="w-px flex-1 bg-white/[0.06]" />
    </div>
  );
}

// ─── Columna histórica droppable (modo interactivo) ──────────────────────────

function DroppableHistoricalMonthColumn({
  group,
  editors,
  clients,
  availableParents = [],
}: {
  group: { key: string; label: string; items: ProjectWithRelations[] };
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
}) {
  const droppableId = `hist:${group.key}`;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });
  const itemIds = useMemo(() => group.items.map((p) => p.id), [group.items]);

  return (
    <div
      ref={setNodeRef}
      className={`relative flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[10px] border bg-[#1a1a1a] min-h-[70vh] transition-colors ${
        isOver ? "border-primary/60 ring-2 ring-inset ring-primary/40" : "border-white/[0.08]"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48"
        style={{ background: "radial-gradient(ellipse 100% 140px at 50% 0%, #37FF6210, transparent)" }}
      />
      <div className="relative flex flex-1 flex-col gap-3 px-[15px] py-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-xl font-[200] uppercase tracking-tight">{group.label}</span>
          <span className="text-xl font-semibold tabular-nums text-white">{group.items.length}</span>
        </div>
        <TerminadoStats items={group.items} />
        <SortableContext id={droppableId} items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {group.items.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs italic text-muted-foreground">
                Arrastrá una card acá
              </p>
            ) : (
              group.items.map((p) => (
                <SortableCard
                  key={p.id}
                  project={p}
                  editors={editors}
                  clients={clients}
                  availableParents={availableParents}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// ─── Columna histórica (solo lectura, SSR) ────────────────────────────────────

function HistoricalMonthColumn({
  group,
  editors,
  clients,
  availableParents = [],
}: {
  group: { key: string; label: string; items: ProjectWithRelations[] };
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
}) {
  return (
    <div className="relative flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#1a1a1a] min-h-[70vh]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48"
        style={{ background: "radial-gradient(ellipse 100% 140px at 50% 0%, #37FF6210, transparent)" }}
      />
      <div className="relative flex flex-1 flex-col gap-3 overflow-y-auto px-[15px] py-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-xl font-[200] uppercase tracking-tight">{group.label}</span>
          <span className="text-xl font-semibold tabular-nums text-white">{group.items.length}</span>
        </div>
        <TerminadoStats items={group.items} />
        {group.items.map((p) => (
          <div key={p.id} className="flex flex-col">
            <PackBadge project={p} />
            <CardView
              project={p}
              editors={editors}
              clients={clients}
              availableParents={availableParents}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Columna ──────────────────────────────────────────────────────────────────

function KanbanColumn({
  phase,
  items,
  editors,
  clients,
  availableParents = [],
  monthLabel,
  mk,
}: {
  phase: ProjectPhase;
  items: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
  monthLabel?: string;
  mk?: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: phase });
  const itemIds = useMemo(() => items.map((p) => p.id), [items]);

  const emptyLabel =
    phase === "terminado"
      ? "Arrastrá una card acá"
      : "Soltá una tarjeta acá";

  return (
    <div
      ref={setNodeRef}
      className={`relative flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[10px] border bg-[#1a1a1a] min-h-[70vh] transition-colors ${
        isOver ? "border-primary/60 ring-2 ring-inset ring-primary/40" : "border-white/[0.08]"
      }`}
    >
      {PHASE_BLOB[phase] ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48"
          style={{ background: `radial-gradient(ellipse 100% 140px at 50% 0%, ${PHASE_BLOB[phase]}, transparent)` }}
        />
      ) : null}
      <div className="relative flex flex-1 flex-col gap-3 px-[15px] py-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-xl font-[200] uppercase tracking-tight">
            {monthLabel ?? PHASE_LABEL[phase]}
          </span>
          <span className="text-xl font-semibold tabular-nums text-white">
            {items.length}
          </span>
        </div>
        {phase === "terminado" && <TerminadoStats items={items} mk={mk} />}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          <SortableContext
            id={phase}
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            {items.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs italic text-muted-foreground">
                {emptyLabel}
              </p>
            ) : phase === "terminado" ? (
              groupTerminadoByMonth(items).map(({ key, label, items: monthItems }) => (
                <Fragment key={key}>
                  <div className="px-1 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                    {label}
                  </div>
                  {monthItems.map((p) => (
                    <SortableCard
                      key={p.id}
                      project={p}
                      editors={editors}
                      clients={clients}
                      availableParents={availableParents}
                    />
                  ))}
                </Fragment>
              ))
            ) : (
              items.map((p) => (
                <SortableCard
                  key={p.id}
                  project={p}
                  editors={editors}
                  clients={clients}
                  availableParents={availableParents}
                />
              ))
            )}
          </SortableContext>
          {phase !== "terminado" ? (
            <KanbanAddButton
              phase={phase}
              editors={editors}
              clients={clients}
              availableParents={availableParents}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Sortable card ────────────────────────────────────────────────────────────

function SortableCard({
  project,
  editors,
  clients,
  availableParents = [],
}: {
  project: ProjectWithRelations;
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-30" : ""}
    >
      <PackBadge project={project} />
      <CardView
        project={project}
        editors={editors}
        clients={clients}
        availableParents={availableParents}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ─── Card view ────────────────────────────────────────────────────────────────

function CardView({
  project,
  editors,
  clients,
  availableParents = [],
  dragging,
  dragHandleProps,
}: {
  project: ProjectWithRelations;
  editors?: EditorMini[];
  clients?: ClientForProject[];
  availableParents?: ParentOption[];
  dragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const { menuFocusId, setMenuFocusId, editFocusId, setEditFocusId, setDndDisabled } = useContext(KanbanFocusCtx);
  const highlightedId = useContext(KanbanHighlightCtx);

  const [editOpen, setEditOpen] = useState(false);

  // Cualquiera de los dos focos activos mantiene el blur en otras cards.
  const effectiveFocusedId = menuFocusId ?? editFocusId;
  const isBlurred = effectiveFocusedId !== null && effectiveFocusedId !== project.id && !editOpen;

  // ── Scroll desde link de Discord (?focus=ID) ─────────────────────────────
  const isHighlighted = highlightedId === project.id;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHighlighted) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEditOpenChange(open: boolean) {
    setEditOpen(open);
    setEditFocusId(open ? project.id : null);
    setDndDisabled(open);
  }

  function handleMenuOpenChange(open: boolean) {
    setMenuFocusId(open ? project.id : null);
  }

  const [expanded, setExpanded] = useState(false);

  const isMensual = project.client?.payment_type === "mensual";

  const editorEntries = project.editors.filter((e) => e.editor != null);

  return (
    <Card
      ref={cardRef}
      size="sm"
      className={`relative !rounded-[5px] !py-0 !gap-0 !bg-[#2c2c2c] transition-[filter,opacity] duration-200 ${
        dragging ? "rotate-2 shadow-lg ring-2 ring-primary/40" : ""
      } ${isBlurred ? "blur-[2px] opacity-35 pointer-events-none select-none" : ""} ${
        editOpen ? "z-[51]" : ""
      }`}
    >
      {/* ── Drag handle + header ──────────────────────────────────────────── */}
      <div
        className="cursor-grab active:cursor-grabbing"
        {...dragHandleProps}
      >
        <div className="flex flex-col gap-2 px-4 pt-[10px] pb-2">
          {/* Fila: chips de cliente + tipo, y acciones a la derecha */}
          <div className="flex items-center gap-1.5">
            {project.client ? (
              <span
                className={CARD_CLIENT_CHIP_BASE}
                style={{
                  backgroundColor: project.client.color,
                  color: contrastColor(project.client.color),
                }}
              >
                <span className="truncate">{project.client.name}</span>
              </span>
            ) : project.client_name ? (
              <span className={`${CARD_CHIP_BASE} max-w-[150px] overflow-hidden bg-muted text-muted-foreground`}>
                <span className="truncate">{project.client_name}</span>
              </span>
            ) : null}
            {!isPack(project) ? (
              <span className={`${CARD_TYPE_CHIP_BASE} ${CARD_TYPE_CHIP[project.project_type]}`}>
                {CARD_TYPE_INITIAL[project.project_type]}
              </span>
            ) : null}
            <div className="flex-1" />
            {editors && clients ? (
              <>
                <KanbanCardActions
                  project={project}
                  editors={editors}
                  clients={clients}
                  availableParents={availableParents}
                  onMenuOpenChange={handleMenuOpenChange}
                  editOpen={editOpen}
                  onEditOpenChange={handleEditOpenChange}
                />
                <Link
                  href={`/projects?highlight=${project.id}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Ver en proyectos"
                >
                  <ArrowUpRightIcon className="size-4" />
                </Link>
              </>
            ) : null}
          </div>

          {/* Título con bullet */}
          <h3 className="text-[15px] font-bold leading-snug">
            <span className="mr-1.5 text-muted-foreground/40">•</span>
            {project.title}
          </h3>

          {/* Lista de hijos para proyectos pack */}
          {isPack(project) && project.children && project.children.length > 0 ? (
            <div className="flex flex-col gap-0.5 pl-1">
              {project.children.slice(0, 2).map((child) => (
                <div key={child.id} className="flex items-center gap-2 text-[11px] text-muted-foreground/55">
                  <span className="shrink-0 text-muted-foreground/30">—</span>
                  <span className="truncate">{child.title}</span>
                </div>
              ))}
              {project.children.length > 2 ? (
                <div className="pl-4 text-[11px] text-muted-foreground/35">
                  +{project.children.length - 2}...
                </div>
              ) : null}
            </div>
          ) : null}

        </div>
      </div>

      {/* ── Body: editores + expand ───────────────────────────────────────── */}
      <CardContent className="flex flex-col gap-2 !px-4 pt-0 pb-[10px]">
        <div className="flex items-center justify-between gap-2">
          {/* Editor chips */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {editorEntries.length > 0 ? (
              editorEntries.map((e) => (
                <span
                  key={e.editor!.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/30 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {e.editor!.name}
                </span>
              ))
            ) : (
              <span className="text-[10px] italic text-muted-foreground/50">
                Sin editor
              </span>
            )}
          </div>
          {/* Chevron expand */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={expanded ? "Colapsar" : "Expandir"}
          >
            <ChevronDownIcon
              className={`size-4 transition-transform duration-200 ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* ── Sección expandible ────────────────────────────────────────── */}
        {expanded ? (
          <div className="flex flex-col gap-2 border-t border-border/40 pt-2 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Duración */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Duración
              </span>
              <QuickDurationEditor
                id={project.id}
                value={project.duration_minutes}
                size="compact"
              />
            </div>

            {/* Badges financieros */}
            <div
              className={`grid gap-2 ${isMensual ? "grid-cols-2" : "grid-cols-3"}`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {!isMensual ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/55">Cobrado</span>
                  <QuickPaymentBadge kind="cobrado" id={project.id} value={project.cobrado} />
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/55">Pagado</span>
                <QuickPaymentBadge kind="pagado" id={project.id} value={project.pagado} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/55">Facturado</span>
                <QuickPaymentBadge kind="invoiced" id={project.id} value={project.invoiced} />
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

