import type {
  CobradoStatus,
  CurrencyCode,
  InvoicedStatus,
  PagadoStatus,
  ProjectPhase,
} from "./types";

export const PHASE_LABEL: Record<ProjectPhase, string> = {
  por_asignar: "Por asignar",
  editando: "Editando",
  terminado: "Terminado",
};

export const PHASE_CLASS: Record<ProjectPhase, string> = {
  por_asignar:
    "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300",
  editando: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  terminado:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

export const COBRADO_LABEL: Record<CobradoStatus, string> = {
  si: "Sí",
  no: "No",
  parcial: "Parcial",
};

export const PAGADO_LABEL: Record<PagadoStatus, string> = {
  pago_total: "Pagado",
  parcial: "Parcial",
  sin_pagar: "Sin pagar",
};

export const INVOICED_LABEL: Record<InvoicedStatus, string> = {
  si: "Sí",
  no: "No",
  parcial: "Parcial",
};

export const COBRADO_CLASS: Record<CobradoStatus, string> = {
  si: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  no: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300",
  parcial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export const PAGADO_CLASS: Record<PagadoStatus, string> = {
  pago_total:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  sin_pagar: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300",
  parcial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export const INVOICED_CLASS: Record<InvoicedStatus, string> = {
  si: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  no: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300",
  parcial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  ARS: "ARS — Peso argentino",
  USD: "USD — Dólar",
  EUR: "EUR — Euro",
};

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

const currencyFormatters = new Map<CurrencyCode, Intl.NumberFormat>();

function getCurrencyFormatter(currency: CurrencyCode): Intl.NumberFormat {
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(currency, fmt);
  }
  return fmt;
}

export function formatPrice(
  price: number | string | null,
  currency: CurrencyCode = "ARS"
): string {
  if (price == null) return "—";
  const n = typeof price === "string" ? Number(price) : price;
  if (Number.isNaN(n)) return "—";
  return getCurrencyFormatter(currency).format(n);
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
