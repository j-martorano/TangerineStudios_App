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

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
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
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKeyOf(d);
}

export function monthLabelUpper(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const idx = m - 1;
  return `${MONTH_NAMES[idx]?.toUpperCase() ?? "—"} ${y}`;
}

/** "Sábado 13" — día de hoy en español. */
export function todayLabel(): string {
  const now = new Date();
  const day = DAY_NAMES[now.getDay()] ?? "";
  return `${day} ${now.getDate()}`;
}

/** Flechas de navegación de mes — sin caja, solo iconos. */
export function MonthNav({ current }: { current: string }) {
  const prev = shiftMonth(current, -1);
  const next = shiftMonth(current, 1);
  const today = currentMonthKey();
  const canGoForward = current < today;

  return (
    <div className="inline-flex items-center gap-0.5">
      <Link
        href={`/?month=${prev}`}
        aria-label="Mes anterior"
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeftIcon className="size-5" />
      </Link>
      {canGoForward ? (
        <Link
          href={`/?month=${next}`}
          aria-label="Mes siguiente"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRightIcon className="size-5" />
        </Link>
      ) : (
        <span className="flex size-7 items-center justify-center text-muted-foreground/20">
          <ChevronRightIcon className="size-5" />
        </span>
      )}
    </div>
  );
}
