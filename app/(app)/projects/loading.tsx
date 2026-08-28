import { Skeleton } from "@/components/ui/skeleton";

const COL_WIDTHS = [180, 90, 90, 100, 90, 90, 80];

export default function ProjectsLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-60 rounded-lg" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        {/* Header */}
        <div className="flex gap-3 border-b bg-muted/30 px-4 py-3">
          {COL_WIDTHS.map((w, i) => (
            <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex gap-3 items-center border-b px-4 py-3 last:border-0">
            {COL_WIDTHS.map((w, j) => (
              <Skeleton
                key={j}
                className="h-4 rounded"
                style={{ width: j === 0 ? w : w * (0.5 + Math.random() * 0.5) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
