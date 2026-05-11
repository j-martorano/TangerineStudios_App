"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { KanbanCardActions } from "./kanban-card-actions";

import { PROJECT_STATUSES } from "@/lib/projects/types";
import type {
  ClientMini,
  EditorMini,
  ProjectStatus,
  ProjectWithRelations,
} from "@/lib/projects/types";
import { STATUS_CLASS, STATUS_LABEL, formatPrice } from "@/lib/projects/format";
import { reorderProjects } from "@/lib/projects/actions";

type Props = {
  projects: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientMini[];
};

type ColumnsMap = Record<ProjectStatus, ProjectWithRelations[]>;

function buildColumns(projects: ProjectWithRelations[]): ColumnsMap {
  const map = {} as ColumnsMap;
  for (const status of PROJECT_STATUSES) map[status] = [];
  for (const p of projects) map[p.status].push(p);
  for (const status of PROJECT_STATUSES) {
    map[status].sort((a, b) => a.position - b.position);
  }
  return map;
}

function findContainer(cols: ColumnsMap, id: string): ProjectStatus | null {
  if ((PROJECT_STATUSES as string[]).includes(id)) {
    return id as ProjectStatus;
  }
  for (const status of PROJECT_STATUSES) {
    if (cols[status].some((p) => p.id === id)) return status;
  }
  return null;
}

export function ProjectsKanban(props: Props) {
  // dnd-kit asigna IDs incrementales que difieren entre server y client.
  // Renderizamos una versión estática hasta el primer mount y después
  // intercambiamos a la versión interactiva. Evita el hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <StaticKanban {...props} />;
  return <InteractiveKanban {...props} />;
}

function StaticKanban({ projects, editors, clients }: Props) {
  const columns = buildColumns(projects);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {PROJECT_STATUSES.map((status) => {
        const items = columns[status];
        return (
          <div key={status} className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
              >
                {STATUS_LABEL[status]}
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

function InteractiveKanban({ projects, editors, clients }: Props) {
  const [columns, setColumns] = useState<ColumnsMap>(() =>
    buildColumns(projects)
  );
  const columnsRef = useRef<ColumnsMap>(columns);
  columnsRef.current = columns;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setColumns(buildColumns(projects));
  }, [projects]);

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
        { ...moving, status: overContainer },
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
      status: ProjectStatus;
      position: number;
    }[] = [];
    const affected = new Set([activeContainer, overContainer]);
    for (const status of affected) {
      next[status].forEach((p, idx) => {
        updates.push({ id: p.id, status, position: idx });
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {PROJECT_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={columns[status]}
            editors={editors}
            clients={clients}
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
  status,
  items,
  editors,
  clients,
}: {
  status: ProjectStatus;
  items: ProjectWithRelations[];
  editors: EditorMini[];
  clients: ClientMini[];
}) {
  const { isOver, setNodeRef } = useDroppableColumn(status);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </div>
      <SortableContext
        id={status}
        items={items.map((p) => p.id)}
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
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function useDroppableColumn(id: ProjectStatus) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return { setNodeRef, isOver };
}

function SortableCard({
  project,
  editors,
  clients,
}: {
  project: ProjectWithRelations;
  editors: EditorMini[];
  clients: ClientMini[];
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
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function CardView({
  project,
  editors,
  clients,
  dragging,
  dragHandleProps,
}: {
  project: ProjectWithRelations;
  editors?: EditorMini[];
  clients?: ClientMini[];
  dragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <Card
      size="sm"
      className={`relative ${dragging ? "rotate-2 shadow-lg ring-2 ring-primary/40" : ""}`}
    >
      {editors && clients ? (
        <div className="absolute right-1 top-1 z-10">
          <KanbanCardActions
            project={project}
            editors={editors}
            clients={clients}
          />
        </div>
      ) : null}
      <CardHeader
        className="cursor-grab active:cursor-grabbing"
        {...dragHandleProps}
      >
        <CardTitle className="line-clamp-2 pr-8 text-sm">
          {project.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="truncate">
          {project.client?.name ?? project.client_name ?? "—"}
        </span>
        <div className="flex items-center justify-between gap-2 pt-1 text-foreground">
          <span className="tabular-nums">
            {formatPrice(project.price, project.currency)}
          </span>
          <span className="truncate text-muted-foreground">
            {project.editor?.name ?? "—"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
