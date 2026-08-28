import { Skeleton } from "@/components/ui/skeleton";

export default function FinanzasLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Month stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-5 flex flex-col gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-32" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl lg:col-span-2" />
        <Skeleton className="h-48 rounded-xl" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[100, 90, 80].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-md" style={{ width: w }} />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border px-4 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
