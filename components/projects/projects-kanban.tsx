"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { GripHorizontalIcon } from "lucide-react";
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

import { KanbanCardActions } from "./kanban-card-actions";
import type { ParentOption } from "./project-form";
import { QuickDurationEditor } from "./quick-duration-editor";

import {
  PROJECT_PHASES,
  PROJECT_TYPE_CLASS,
  PROJECT_TYPE_LABEL,
  editorNames,
} from "@/lib/projects/types";
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
  computeProfit,
  formatPrice,
} from "@/lib/projects/format";
import { reorderProjects, type ReorderUpdate } from "@/lib/projects/actions";

type Props = {
  projects: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
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
  return `${hex}1f`;
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

// ─── Export ───────────────────────────────────────────────────────────────────

export function ProjectsKanban(props: Props) {
  const [mounted, setMounted] = useState(false);
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
        .map((p) => `${p.id}:${p.phase}:${p.position}:${p.finalized}`)
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
  return (
    <Card
      size="sm"
      className={`relative ${dragging ? "rotate-2 shadow-lg ring-2 ring-primary/40" : ""}`}
      style={{ backgroundColor: clientTint(project.client?.color) }}
    >
      {editors && clients ? (
        <div className="absolute right-1 top-1 z-10">
          <KanbanCardActions
            project={project}
            editors={editors}
            clients={clients}
            availableParents={availableParents}
          />
        </div>
      ) : null}

      <div
        className="relative -mt-3 cursor-grab border-b border-border/40 bg-muted/40 px-3 pt-5 pb-3 active:cursor-grabbing"
        {...dragHandleProps}
      >
        <GripHorizontalIcon
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1 size-3.5 -translate-x-1/2 text-muted-foreground/60"
        />
        {project.parent ? (
          <span
            className="mb-1 inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-300"
            title={`Pertenece al pack «${project.parent.title}»`}
          >
            <span className="max-w-[120px] truncate">
              Pack · {project.parent.title}
            </span>
            <span className="opacity-70">
              · {project.parent.finalizedChildren}/
              {project.parent.totalChildren}
            </span>
          </span>
        ) : null}
        <div className="mb-0.5 flex items-center justify-between gap-2 pr-8">
          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {project.project_code}
          </p>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${PROJECT_TYPE_CLASS[project.project_type]}`}
          >
            {PROJECT_TYPE_LABEL[project.project_type]}
          </span>
        </div>
        <h3 className="line-clamp-2 pr-8 text-sm font-medium leading-snug">
          {project.title}
        </h3>
      </div>

      <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
        {project.client ? (
          <span className="inline-flex items-center gap-1.5 truncate">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: project.client.color }}
            />
            <span className="truncate">{project.client.name}</span>
          </span>
        ) : (
          <span className="truncate">{project.client_name ?? "—"}</span>
        )}
        <span className="truncate">{editorNames(project)}</span>
        <div className="flex items-center justify-between gap-2 pt-1 text-foreground">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Duración
          </span>
          <QuickDurationEditor
            id={project.id}
            value={project.duration_minutes}
            size="compact"
          />
        </div>
        {(() => {
          const isMensual = project.client?.payment_type === "mensual";
          const price = isMensual ? null : computePrice(project);
          const cost = computeCost(project);
          const profit = computeProfit(project);
          const profitClass =
            profit == null
              ? ""
              : profit < 0
                ? "text-destructive"
                : "text-emerald-500";
          return (
            <div className="grid grid-cols-3 gap-1 pt-1 text-foreground">
              <Stat
                label="Precio"
                value={
                  isMensual
                    ? "RETAINER"
                    : price != null
                      ? formatPrice(price)
                      : "—"
                }
              />
              <Stat
                label="Costo"
                value={cost != null ? formatPrice(cost) : "—"}
              />
              <Stat
                label="Ganancia"
                value={profit != null ? formatPrice(profit) : "—"}
                valueClass={profitClass}
              />
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={`tabular-nums ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}
