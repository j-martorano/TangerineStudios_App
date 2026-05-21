import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

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

/** Devuelve "YYYY-MM" para una fecha. */
export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  return monthKeyOf(new Date());
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  // m es 1-indexed; el constructor de Date usa 0-indexed.
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKeyOf(d);
}

export function monthLabelUpper(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const idx = m - 1;
  return `${MONTH_NAMES[idx]?.toUpperCase() ?? "—"} ${y}`;
}

export function MonthNav({ current }: { current: string }) {
  const prev = shiftMonth(current, -1);
  const next = shiftMonth(current, 1);
  const today = currentMonthKey();
  const isAtCurrent = current === today;
  const canGoForward = current < today;

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5">
      <Link
        href={`/?month=${prev}`}
        aria-label="Mes anterior"
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
      </Link>
      <span className="min-w-[120px] text-center text-sm font-semibold uppercase tracking-wide tabular-nums">
        {monthLabelUpper(current)}
      </span>
      {canGoForward ? (
        <Link
          href={`/?month=${next}`}
          aria-label="Mes siguiente"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      ) : (
        <span className="flex size-7 items-center justify-center text-muted-foreground/20">
          <ChevronRightIcon className="size-4" />
        </span>
      )}
      {!isAtCurrent ? (
        <Link
          href="/"
          className="ml-1 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Hoy
        </Link>
      ) : null}
    </div>
  );
}
