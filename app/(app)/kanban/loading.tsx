import { Skeleton } from "@/components/ui/skeleton";

const COLUMNS = ["Por Asignar", "Editando", "En Revisión", "Terminado"];
const CARD_COUNTS = [3, 4, 2, 5];

export default function KanbanLoading() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-60 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      {/* Columns */}
      <div className="flex flex-1 gap-3 overflow-x-hidden pb-4">
        {COLUMNS.map((col, ci) => (
          <div key={col} className="flex w-64 shrink-0 flex-col gap-2">
            {/* Column header */}
            <div className="flex items-center gap-2 px-1">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            {/* Cards */}
            {Array.from({ length: CARD_COUNTS[ci] }).map((_, i) => (
              <div key={i} className="rounded-xl border p-3 flex flex-col gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-1 pt-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
