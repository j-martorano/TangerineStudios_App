import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  perPage: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
};

export function DataPagination({
  page,
  perPage,
  total,
  basePath,
  searchParams,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (totalPages <= 1) {
    return (
      <p className="px-1 text-xs text-muted-foreground tabular-nums">
        {total} {total === 1 ? "resultado" : "resultados"}
      </p>
    );
  }

  function buildUrl(targetPage: number): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v != null && k !== "page") params.set(k, v);
    }
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  const start = (page - 1) * perPage + 1;
  const end = Math.min(start + perPage - 1, total);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <p className="text-xs text-muted-foreground tabular-nums">
        Mostrando {start}–{end} de {total}
      </p>
      <div className="flex items-center gap-1">
        {prevDisabled ? (
          <Button size="sm" variant="outline" disabled>
            <ChevronLeftIcon className="size-4" />
            Anterior
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            render={<Link href={buildUrl(page - 1)} scroll={false} />}
          >
            <ChevronLeftIcon className="size-4" />
            Anterior
          </Button>
        )}
        <span className="px-2 text-xs text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>
        {nextDisabled ? (
          <Button size="sm" variant="outline" disabled>
            Siguiente
            <ChevronRightIcon className="size-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            render={<Link href={buildUrl(page + 1)} scroll={false} />}
          >
            Siguiente
            <ChevronRightIcon className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
