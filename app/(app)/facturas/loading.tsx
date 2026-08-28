import { Skeleton } from "@/components/ui/skeleton";

export default function FacturasLoading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="flex gap-4 border-b bg-muted/30 px-4 py-3">
          {[120, 160, 100, 80, 80, 60].map((w, i) => (
            <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="ml-auto h-7 w-7 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
