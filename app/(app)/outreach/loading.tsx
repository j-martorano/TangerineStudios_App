import { Skeleton } from "@/components/ui/skeleton";

export default function OutreachLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <Skeleton className="h-12 w-64 rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-8 w-44 rounded-lg" />
      </div>
      <Skeleton className="h-56 w-full rounded-lg" />
      <div className="flex gap-6">
        <Skeleton className="h-24 w-64 rounded-lg" />
        <Skeleton className="h-24 w-64 rounded-lg" />
        <Skeleton className="ml-auto h-24 w-72 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        <Skeleton className="h-16 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-none border-t" />
        ))}
      </div>
    </div>
  );
}
