import type { ProjectStatus } from "./types";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  pending: "Sin empezar",
  in_progress: "En proceso",
  revising: "Corrigiendo",
  done: "Terminado",
  invoiced: "Cobrado",
};

export const STATUS_CLASS: Record<ProjectStatus, string> = {
  pending: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  revising: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  invoiced: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

export function formatPrice(price: number | string | null): string {
  if (price == null) return "—";
  const n = typeof price === "string" ? Number(price) : price;
  if (Number.isNaN(n)) return "—";
  return currencyFormatter.format(n);
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
