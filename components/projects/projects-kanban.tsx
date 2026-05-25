"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
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
import {
  ChevronDownIcon,
  ChevronRightIcon,
  GripHorizontalIcon,
} from "lucide-react";
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

// Las tres fases del tablero activo (columnas del área principal)
const ACTIVE_PHASES: ProjectPhase[] = ["por_asignar", "editando", "en_revision"];

type Props = {
  projects: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
};

type ColumnsMap = Record<ProjectPhase, ProjectWithRelations[]>;

type PendingFinalize = {
  /** ID del proyecto que se está moviendo a terminado */
  projectId: string;
  /** Fecha ISO original (antes del drag) */
  existingFinalizedAt: string;
  /** Estado de columnas previo — para rollback si el user cancela */
  rollbackCols: ColumnsMap;
  /** Updates base (con finalized=true pero sin finalized_at resuelto aún) */
  baseUpdates: ReorderUpdate[];
};

// Tinte del cliente sobre la card (~8% de opacidad)
function clientTint(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  return `${hex}1f`;
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
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

  const boardProps = {
    projects: props.projects,
    editors: props.editors,
    clients: props.clients,
    availableParents: props.availableParents ?? [],
  };

  return mounted ? (
    <InteractiveKanban {...boardProps} />
  ) : (
    <StaticKanban {...boardProps} />
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
    <div className="flex flex-col gap-8">
      {/* Columnas activas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIVE_PHASES.map((phase) => (
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
      {/* Sección Terminado */}
      <TerminadoSection
        projects={columns["terminado"]}
        editors={editors}
        clients={clients}
        availableParents={availableParents}
        interactive={false}
      />
    </div>
  );
}

// ─── Interactive (client DnD) ─────────────────────────────────────────────────

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

  // Sincronizamos con datos del servidor sólo cuando cambia el contenido real.
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

  // ── DnD handlers ─────────────────────────────────────────────────────────

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
    // Capturamos sourcePhase antes de resetear
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

    // Sin-op: movimiento dentro de terminado (no ordenamos el log)
    if (sourcePhase === "terminado" && overContainer === "terminado") return;

    let next = prevCols;

    // Reorden dentro de una columna activa
    if (
      activeContainer === overContainer &&
      activeContainer !== "terminado"
    ) {
      const items = prevCols[activeContainer];
      const activeIndex = items.findIndex((p) => p.id === activeIdStr);
      const overIndex = items.findIndex((p) => p.id === overIdStr);
      if (
        activeIndex !== -1 &&
        overIndex !== -1 &&
        activeIndex !== overIndex
      ) {
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
        // Movido DESDE terminado → activo: des-finalizar
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

    // Movido HACIA terminado desde activo
    if (overContainer === "terminado" && sourcePhase !== "terminado") {
      const original = projects.find((p) => p.id === activeIdStr);
      const existingDate = original?.finalized_at
        ? original.finalized_at.slice(0, 10)
        : null;
      const today = todayUTC();

      if (existingDate && existingDate !== today) {
        // Mostrar AlertDialog para elegir fecha
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

      // Finalizar con la fecha de hoy
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

    // Commit normal (activo ↔ activo, o terminado → activo)
    if (updates.length > 0) {
      startTransition(async () => {
        const result = await reorderProjects(updates);
        if (!result.ok) toast.error(result.error);
      });
    }
  }

  // ── Handlers del AlertDialog ──────────────────────────────────────────────

  function handleUsarHoy() {
    if (!pendingFinalize) return;
    const { projectId, baseUpdates } = pendingFinalize;
    const today = todayUTC();
    const finalUpdates = baseUpdates.map((u) =>
      u.id === projectId
        ? { ...u, finalized_at: `${today}T12:00:00Z` }
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

  // ── Render ────────────────────────────────────────────────────────────────

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
        <div className="flex flex-col gap-8">
          {/* Tres columnas activas */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIVE_PHASES.map((phase) => (
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
          {/* Sección Terminado — droppable + log por mes */}
          <TerminadoSection
            projects={columns["terminado"]}
            editors={editors}
            clients={clients}
            availableParents={availableParents}
            interactive
          />
        </div>
        <DragOverlay>
          {activeProject ? (
            <CardView project={activeProject} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* AlertDialog: re-terminar con fecha distinta */}
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

// ─── Columna activa ───────────────────────────────────────────────────────────

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
              Soltá una tarjeta acá
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

// ─── Sección Terminado ────────────────────────────────────────────────────────

function TerminadoSection({
  projects,
  editors,
  clients,
  availableParents = [],
  interactive,
}: {
  projects: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
  interactive: boolean;
}) {
  // Agrupamos por mes de finalized_at
  const byMonth: Record<string, ProjectWithRelations[]> = {};
  for (const p of projects) {
    const mk = monthKey(p.finalized_at);
    if (!byMonth[mk]) byMonth[mk] = [];
    byMonth[mk].push(p);
  }
  const sortedMonths = Object.keys(byMonth).sort().reverse();
  const currentMk = monthKey(new Date().toISOString());

  const inner = (
    <div className="flex flex-col gap-3">
      {/* Encabezado */}
      <div className="flex items-center gap-3 px-1">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_CLASS.terminado}`}
        >
          {PHASE_LABEL.terminado}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {projects.length}
        </span>
        {interactive && projects.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">
            — arrastrá una card acá para finalizar un proyecto
          </span>
        ) : null}
      </div>

      {/* Contenido */}
      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-xs italic text-muted-foreground">
          Sin proyectos finalizados todavía
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedMonths.map((mk) => (
            <MonthGroup
              key={mk}
              mk={mk}
              projects={byMonth[mk]}
              defaultOpen={mk === currentMk}
              interactive={interactive}
              editors={editors}
              clients={clients}
              availableParents={availableParents}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (!interactive) return inner;

  return <DroppableTerminadoWrapper>{inner}</DroppableTerminadoWrapper>;
}

/** Envuelve la sección Terminado como zona droppable */
function DroppableTerminadoWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "terminado" });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-4 transition-colors ${
        isOver
          ? "border-emerald-500/40 bg-emerald-500/5 ring-2 ring-emerald-500/20"
          : "border-border/40 bg-muted/5"
      }`}
    >
      {children}
    </div>
  );
}

/** Grupo de proyectos de un mes dentro del log de Terminado */
function MonthGroup({
  mk,
  projects,
  defaultOpen,
  interactive,
  editors,
  clients,
  availableParents = [],
}: {
  mk: string;
  projects: ProjectWithRelations[];
  defaultOpen: boolean;
  interactive: boolean;
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-border/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/30"
      >
        {open ? (
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span>{monthLabel(mk)}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {projects.length}
        </span>
      </button>

      {open ? (
        <div className="border-t border-border/40 p-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) =>
              interactive ? (
                <DraggableTerminadoCard
                  key={p.id}
                  project={p}
                  editors={editors}
                  clients={clients}
                  availableParents={availableParents}
                />
              ) : (
                <CardView
                  key={p.id}
                  project={p}
                  editors={editors}
                  clients={clients}
                  availableParents={availableParents}
                />
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Card en la sección Terminado: draggable (puede volverse activa de nuevo) */
function DraggableTerminadoCard({
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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: project.id });
  const style = { transform: CSS.Transform.toString(transform) };

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

// ─── Sortable card (columnas activas) ─────────────────────────────────────────

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

// ─── Card view (compartida por ambas secciones) ───────────────────────────────

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

      {/* Drag handle */}
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
