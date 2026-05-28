"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
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
import { ChevronDownIcon, GripHorizontalIcon } from "lucide-react";
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
import type { ParentOption } from "./project-form";
import { QuickDurationEditor } from "./quick-duration-editor";

import {
  PROJECT_PHASES,
  PROJECT_TYPE_LABEL,
} from "@/lib/projects/types";
import {
  CARD_CHIP_BASE,
  CARD_CLIENT_CHIP_BASE,
  CARD_TYPE_CHIP,
  financialBadgeClass,
  financialBadgeClassStatic,
} from "./kanban-card-styles";
import { CobroManagerPanel } from "./cobro-manager";
import { PagoManagerPanel } from "./pago-manager";
import { contrastColor } from "@/lib/clients/palette";
import type {
  ClientForProject,
  EditorMini,
  ProjectPhase,
  ProjectWithRelations,
} from "@/lib/projects/types";
import {
  PHASE_CLASS,
  PHASE_LABEL,
  computeCost,
  computePrice,
} from "@/lib/projects/format";
import { reorderProjects, type ReorderUpdate } from "@/lib/projects/actions";

type Props = {
  projects: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  clientsForInvoice?: ClientForInvoice[];
  availableParents?: ParentOption[];
  /** ID del proyecto a resaltar (viene del param ?focus=ID del link de Discord) */
  highlightId?: string;
};

type ColumnsMap = Record<ProjectPhase, ProjectWithRelations[]>;

type PendingFinalize = {
  projectId: string;
  existingFinalizedAt: string;
  rollbackCols: ColumnsMap;
  baseUpdates: ReorderUpdate[];
};

function clientTint(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  return `${hex}33`;
}

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

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function buildColumns(projects: ProjectWithRelations[]): ColumnsMap {
  const map = {} as ColumnsMap;
  for (const phase of PROJECT_PHASES) map[phase] = [];
  for (const p of projects) map[p.phase].push(p);
  for (const phase of PROJECT_PHASES) {
    map[phase].sort((a, b) => a.position - b.position);
  }
  return map;
}

function findContainer(cols: ColumnsMap, id: string): ProjectPhase | null {
  if ((PROJECT_PHASES as string[]).includes(id)) return id as ProjectPhase;
  for (const phase of PROJECT_PHASES) {
    if (cols[phase].some((p) => p.id === id)) return phase;
  }
  return null;
}

// ─── Context para efecto blur ─────────────────────────────────────────────────
// Cuando una card abre su menú, las otras se blurean.

const KanbanFocusCtx = createContext<{
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
}>({ focusedId: null, setFocusedId: () => {} });

// ─── Context para highlight desde URL (?focus=ID) ─────────────────────────────
// Cuando se llega desde el link del bot de Discord, se resalta la card.

const KanbanHighlightCtx = createContext<string | null>(null);

const KanbanInvoiceCtx = createContext<{
  onFacturar: (project: ProjectWithRelations) => void;
}>({ onFacturar: () => {} });

// ─── Export ───────────────────────────────────────────────────────────────────

export function ProjectsKanban(props: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [facturarProject, setFacturarProject] = useState<ProjectWithRelations | null>(null);
  useEffect(() => setMounted(true), []);

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
    <KanbanHighlightCtx.Provider value={props.highlightId ?? null}>
    <KanbanFocusCtx.Provider value={{ focusedId, setFocusedId }}>
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
        {months.length > 1 ? (
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
  const columns = buildColumns(projects);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {PROJECT_PHASES.map((phase) => (
        <div key={phase} className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_CLASS[phase]}`}
            >
              {PHASE_LABEL[phase]}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {columns[phase].length}
            </span>
          </div>
          <div className="flex min-h-24 flex-col gap-2 rounded-lg p-1">
            {columns[phase].length === 0 ? (
              <p className="px-1 py-4 text-center text-xs italic text-muted-foreground">
                Sin proyectos
              </p>
            ) : (
              columns[phase].map((p) => (
                <CardView
                  key={p.id}
                  project={p}
                  editors={editors}
                  clients={clients}
                  availableParents={availableParents}
                />
              ))
            )}
          </div>
        </div>
      ))}
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
  const [columns, setColumns] = useState<ColumnsMap>(() =>
    buildColumns(projects)
  );
  const columnsRef = useRef<ColumnsMap>(columns);
  columnsRef.current = columns;

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
    setColumns(buildColumns(projects));
  }, [projectsKey, projects]);

  const sensors = useSensors(
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
      if (activeContainer === overContainer) return prev;

      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((p) => p.id === activeIdStr);
      if (activeIndex === -1) return prev;
      const moving = { ...activeItems[activeIndex], phase: overContainer };

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
        }
        updates.push(u);
      });
    }

    // Movido HACIA terminado
    if (overContainer === "terminado" && sourcePhase !== "terminado") {
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
          rollbackCols: prevCols,
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
      u.id === projectId ? { ...u, finalized_at: `${today}T12:00:00Z` } : u
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
      u.id === projectId ? { ...u, finalized_at: existingFinalizedAt } : u
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
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setActiveSourcePhase(null);
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PROJECT_PHASES.map((phase) => (
            <KanbanColumn
              key={phase}
              phase={phase}
              items={columns[phase]}
              editors={editors}
              clients={clients}
              availableParents={availableParents}
            />
          ))}
        </div>
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
          <AlertDialogContent>
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
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelarFinalize}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleMantenerFecha}
                className="bg-muted text-foreground hover:bg-muted/80"
              >
                Mantener (
                {formatShortDate(pendingFinalize.existingFinalizedAt)})
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

// ─── Columna ──────────────────────────────────────────────────────────────────

function KanbanColumn({
  phase,
  items,
  editors,
  clients,
  availableParents = [],
}: {
  phase: ProjectPhase;
  items: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
}) {
  const { isOver, setNodeRef } = useDroppable({ id: phase });
  const itemIds = useMemo(() => items.map((p) => p.id), [items]);

  const emptyLabel =
    phase === "terminado"
      ? "Arrastrá una card acá"
      : "Soltá una tarjeta acá";

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_CLASS[phase]}`}
        >
          {PHASE_LABEL[phase]}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </div>
      <SortableContext
        id={phase}
        items={itemIds}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={`flex min-h-24 flex-col gap-2 rounded-lg p-1 transition-colors ${
            isOver ? "bg-accent/40 ring-2 ring-primary/40" : ""
          }`}
        >
          {items.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs italic text-muted-foreground">
              {emptyLabel}
            </p>
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
        </div>
      </SortableContext>
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

// ─── Helpers financieros ─────────────────────────────────────────────────────

function computeFinancialPct(project: ProjectWithRelations) {
  // Cobrado
  const price = computePrice(project);
  const cobrosSum = project.cobros.reduce((s, c) => s + Number(c.amount), 0);
  const cobradoFlag = project.cobrado === "si";
  let cobradoPct: number;
  if (cobradoFlag && cobrosSum === 0 && price != null) cobradoPct = 100;
  else if (price != null && price > 0)
    cobradoPct = Math.min(100, Math.round((cobrosSum / price) * 100));
  else cobradoPct = cobradoFlag ? 100 : 0;

  // Pagado
  const cost = computeCost(project);
  const pagosSum = project.editor_pagos.reduce(
    (s, e) => s + Number(e.amount),
    0
  );
  const pagadoFlag = project.pagado === "pago_total";
  let pagadoPct: number;
  if (pagadoFlag && pagosSum === 0 && cost != null) pagadoPct = 100;
  else if (cost != null && cost > 0)
    pagadoPct = Math.min(100, Math.round((pagosSum / cost) * 100));
  else pagadoPct = pagadoFlag ? 100 : 0;

  // Facturado (enum solo, sin manager aún)
  const facturadoPct =
    project.invoiced === "si" ? 100 : project.invoiced === "parcial" ? 50 : 0;

  return { cobradoPct, pagadoPct, facturadoPct };
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
  const { focusedId, setFocusedId } = useContext(KanbanFocusCtx);
  const { onFacturar } = useContext(KanbanInvoiceCtx);
  const highlightedId = useContext(KanbanHighlightCtx);
  const isBlurred = focusedId !== null && focusedId !== project.id;
  const router = useRouter();

  // ── Highlight desde link de Discord (?focus=ID) ───────────────────────────
  const isHighlighted = highlightedId === project.id;
  const [glowing, setGlowing] = useState(isHighlighted);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHighlighted) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setGlowing(false), 3500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [expanded, setExpanded] = useState(false);
  const [openManager, setOpenManager] = useState<"cobrado" | "pagado" | null>(
    null
  );

  // Refresca los datos del servidor tras mutaciones en los managers.
  const handleManagerSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const isMensual = project.client?.payment_type === "mensual";
  const { cobradoPct, pagadoPct, facturadoPct } =
    computeFinancialPct(project);

  function toggleManager(which: "cobrado" | "pagado") {
    if (!expanded) setExpanded(true);
    setOpenManager((prev) => (prev === which ? null : which));
  }

  const editorEntries = project.editors.filter((e) => e.editor != null);

  return (
    <Card
      ref={cardRef}
      size="sm"
      className={`relative transition-[filter,opacity,box-shadow,ring] duration-200 ${
        dragging ? "rotate-2 shadow-lg ring-2 ring-primary/40" : ""
      } ${isBlurred ? "blur-[2px] opacity-35 pointer-events-none select-none" : ""} ${
        glowing ? "ring-2 ring-orange-400/80 ring-offset-2 shadow-[0_0_18px_2px_theme(colors.orange.400/30%)]" : ""
      }`}
      style={{ backgroundColor: clientTint(project.client?.color) }}
    >
      {/* ── Drag handle + header ──────────────────────────────────────────── */}
      <div
        className="relative cursor-grab px-3 pt-5 pb-2 active:cursor-grabbing"
        {...dragHandleProps}
      >
        <GripHorizontalIcon
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1 size-3.5 -translate-x-1/2 text-muted-foreground/50"
        />

        {/* Pack chip */}
        {project.parent ? (
          <span
            className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-300"
            title={`Pack «${project.parent.title}»`}
          >
            <span className="max-w-[120px] truncate">
              Pack · {project.parent.title}
            </span>
            <span className="opacity-70">
              · {project.parent.finalizedChildren}/{project.parent.totalChildren}
            </span>
          </span>
        ) : null}

        {/* Chips row: cliente + tipo */}
        <div className="flex flex-wrap items-center gap-1.5 pr-8">
          {project.client ? (
            <span
              className={CARD_CLIENT_CHIP_BASE}
              style={{
                backgroundColor: project.client.color,
                color: contrastColor(project.client.color),
              }}
            >
              {project.client.name}
            </span>
          ) : project.client_name ? (
            <span
              className={`${CARD_CHIP_BASE} bg-muted text-muted-foreground`}
            >
              {project.client_name}
            </span>
          ) : null}
          <span
            className={`${CARD_CHIP_BASE} ${CARD_TYPE_CHIP[project.project_type]}`}
          >
            {PROJECT_TYPE_LABEL[project.project_type]}
          </span>
        </div>

        {/* Código + título */}
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {project.project_code}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          {project.title}
        </h3>
      </div>

      {/* ── Menu de acciones ──────────────────────────────────────────────── */}
      {editors && clients ? (
        <div className="absolute right-1 top-1 z-10">
          <KanbanCardActions
            project={project}
            editors={editors}
            clients={clients}
            availableParents={availableParents}
            onMenuOpenChange={(open) =>
              setFocusedId(open ? project.id : null)
            }
          />
        </div>
      ) : null}

      {/* ── Body: editores + expand ───────────────────────────────────────── */}
      <CardContent className="flex flex-col gap-2 pt-1">
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
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              if (!next) setOpenManager(null);
            }}
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
              className={`grid gap-1.5 ${isMensual ? "grid-cols-2" : "grid-cols-3"}`}
            >
              {!isMensual ? (
                <FinancialBadge
                  label="Cobrado"
                  pct={cobradoPct}
                  interactive
                  active={openManager === "cobrado"}
                  onClick={() => toggleManager("cobrado")}
                />
              ) : null}
              <FinancialBadge
                label="Pagado"
                pct={pagadoPct}
                interactive
                active={openManager === "pagado"}
                onClick={() => toggleManager("pagado")}
              />
              <FinancialBadge
                label="Facturado"
                pct={facturadoPct}
                interactive
                active={false}
                onClick={() => {
                  if (!expanded) setExpanded(true);
                  onFacturar(project);
                }}
                title={facturadoPct === 100 ? "Facturado" : "Crear factura"}
              />
            </div>

            {/* Manager inline */}
            {openManager === "cobrado" ? (
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <CobroManagerPanel project={project} onSuccess={handleManagerSuccess} />
              </div>
            ) : openManager === "pagado" ? (
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <PagoManagerPanel project={project} onSuccess={handleManagerSuccess} />
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Badge financiero ─────────────────────────────────────────────────────────

function FinancialBadge({
  label,
  pct,
  interactive,
  active,
  onClick,
  title: titleProp,
}: {
  label: string;
  pct: number;
  interactive: boolean;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const colorClass = interactive
    ? financialBadgeClass(pct)
    : financialBadgeClassStatic(pct);

  const ringClass =
    active
      ? "ring-2 ring-current ring-offset-1 ring-offset-background"
      : "";

  const inner = (
    <>
      <span className="text-[8px] uppercase tracking-wider opacity-60">
        {label}
      </span>
      <span className="text-xs font-bold tabular-nums">{pct}%</span>
    </>
  );

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        title={titleProp}
        className={`flex flex-col items-center rounded-lg px-2 py-1.5 text-center transition-colors ${colorClass} ${ringClass}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      title={titleProp}
      className={`flex flex-col items-center rounded-lg px-2 py-1.5 text-center cursor-default ${colorClass}`}
    >
      {inner}
    </div>
  );
}
