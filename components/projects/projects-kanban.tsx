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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
import { reorderProjects } from "@/lib/projects/actions";

type Props = {
  projects: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
};

// Tinte de fondo de la card con el color del cliente (~12% de opacidad).
function clientTint(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  return `${hex}1f`; // hex de 8 dígitos: #RRGGBB + alpha 0x1f
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

type ColumnsMap = Record<ProjectPhase, ProjectWithRelations[]>;

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
  if ((PROJECT_PHASES as string[]).includes(id)) {
    return id as ProjectPhase;
  }
  for (const phase of PROJECT_PHASES) {
    if (cols[phase].some((p) => p.id === id)) return phase;
  }
  return null;
}

export function ProjectsKanban(props: Props) {
  // dnd-kit asigna IDs incrementales que difieren entre server y client.
  // Renderizamos una versión estática hasta el primer mount y después
  // intercambiamos a la versión interactiva. Evita el hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Filtro por mes (created_at). "all" = todos.
  const [month, setMonth] = useState<string>("all");

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const p of props.projects) set.add(monthKey(p.created_at));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [props.projects]);

  // Auto-carry: cuando se selecciona un mes, además de los proyectos de ese
  // mes mostramos los pendientes (no finalizados) de meses anteriores. Como
  // el kanban ya filtra finalizados al fetch, basta con permitir mes <= X.
  const filtered = useMemo(
    () =>
      month === "all"
        ? props.projects
        : props.projects.filter((p) => monthKey(p.created_at) <= month),
    [props.projects, month]
  );

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
            <MonthTab
              key={m}
              active={month === m}
              onClick={() => setMonth(m)}
            >
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

function StaticKanban({
  projects,
  editors,
  clients,
  availableParents = [],
}: Props) {
  const columns = buildColumns(projects);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PROJECT_PHASES.map((phase) => {
        const items = columns[phase];
        return (
          <div key={phase} className="flex min-w-0 flex-col gap-3">
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
            <div className="flex min-h-24 flex-col gap-2 rounded-lg p-1">
              {items.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs italic text-muted-foreground">
                  Sin proyectos
                </p>
              ) : (
                items.map((p) => (
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
        );
      })}
    </div>
  );
}

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
  const [, startTransition] = useTransition();

  // Sincronizamos columnas locales con projects sólo cuando el contenido
  // cambia de verdad (no en cada re-render). Comparamos por una clave
  // estable: ids + posiciones + fases. Esto evita que setColumns dispare
  // re-renders en cadena que rompen las dependencias de dnd-kit.
  const projectsKey = useMemo(
    () =>
      projects
        .map((p) => `${p.id}:${p.phase}:${p.position}`)
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
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    setColumns((prev) => {
      const activeContainer = findContainer(prev, activeId);
      const overContainer = findContainer(prev, overId);
      if (!activeContainer || !overContainer) return prev;
      if (activeContainer === overContainer) return prev;

      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex((p) => p.id === activeId);
      if (activeIndex === -1) return prev;
      const moving = activeItems[activeIndex];

      let overIndex = overItems.findIndex((p) => p.id === overId);
      if (overIndex === -1) overIndex = overItems.length;

      const newActive = activeItems.filter((_, i) => i !== activeIndex);
      const newOver = [
        ...overItems.slice(0, overIndex),
        { ...moving, phase: overContainer },
        ...overItems.slice(overIndex),
      ];

      return {
        ...prev,
        [activeContainer]: newActive,
        [overContainer]: newOver,
      };
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const prevCols = columnsRef.current;

    const activeContainer = findContainer(prevCols, activeIdStr);
    const overContainer = findContainer(prevCols, overIdStr);
    if (!activeContainer || !overContainer) return;

    let next = prevCols;
    if (activeContainer === overContainer) {
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

    const updates: {
      id: string;
      phase: ProjectPhase;
      position: number;
    }[] = [];
    const affected = new Set([activeContainer, overContainer]);
    for (const phase of affected) {
      next[phase].forEach((p, idx) => {
        updates.push({ id: p.id, phase, position: idx });
      });
    }

    if (updates.length > 0) {
      startTransition(async () => {
        const result = await reorderProjects(updates);
        if (!result.ok) toast.error(result.error);
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        {activeProject ? <CardView project={activeProject} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

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
  const { isOver, setNodeRef } = useDroppableColumn(phase);
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

function useDroppableColumn(id: ProjectPhase) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return { setNodeRef, isOver };
}

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
            <span className="truncate max-w-[120px]">
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
