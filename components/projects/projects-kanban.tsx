import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PROJECT_STATUSES,
} from "@/lib/projects/types";
import type {
  ProjectStatus,
  ProjectWithEditor,
} from "@/lib/projects/types";
import { STATUS_CLASS, STATUS_LABEL, formatPrice } from "@/lib/projects/format";

export function ProjectsKanban({
  projects,
}: {
  projects: ProjectWithEditor[];
}) {
  const byStatus = groupBy(projects, (p) => p.status);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {PROJECT_STATUSES.map((status) => {
        const items = byStatus[status] ?? [];
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
            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <p className="px-1 text-xs italic text-muted-foreground">
                  Sin proyectos
                </p>
              ) : (
                items.map((p) => (
                  <Card key={p.id} size="sm">
                    <CardHeader>
                      <CardTitle className="line-clamp-2 text-sm">
                        {p.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span className="truncate">{p.client_name ?? "—"}</span>
                      <div className="flex items-center justify-between gap-2 pt-1 text-foreground">
                        <span className="tabular-nums">
                          {formatPrice(p.price)}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {p.editor?.name ?? "—"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function groupBy<T>(
  arr: T[],
  key: (item: T) => ProjectStatus
): Partial<Record<ProjectStatus, T[]>> {
  const acc: Partial<Record<ProjectStatus, T[]>> = {};
  for (const item of arr) {
    const k = key(item);
    (acc[k] ??= []).push(item);
  }
  return acc;
}
