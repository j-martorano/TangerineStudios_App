import type {
  ClientMini,
  CobradoStatus,
  CurrencyCode,
  InvoicedStatus,
  PagadoStatus,
  ProjectPhase,
} from "./types";

// Porcentaje que el estudio descuenta del margen para clientes mensuales.
export const MONTHLY_FEE_RATE = 0.1;

type ProjectForCalc = {
  duration_minutes: number | null;
  cost: number | null;
  client: ClientMini | null;
};

// Precio calculado del proyecto:
//   - por_proyecto: client.agreed_price * duration_minutes
//   - mensual: null (no se factura por proyecto, va por saldo mensual)
//   - sin cliente o sin datos: null
export function computePrice(p: ProjectForCalc): number | null {
  const client = p.client;
  if (!client) return null;
  if (client.payment_type === "mensual") return null;
  if (client.agreed_price == null) return null;
  if (p.duration_minutes == null) return null;
  return Number(client.agreed_price) * Number(p.duration_minutes);
}

// Ganancia calculada del proyecto:
//   - por_proyecto: precio - costo
//   - mensual: null (la facturación va por saldo mensual, no por proyecto;
//     la ganancia real se calcula en la Pestaña Finanzas a nivel mes)
// Retorna null si no se puede calcular (faltan datos).
export function computeProfit(p: ProjectForCalc): number | null {
  const client = p.client;
  if (!client) return null;
  if (client.payment_type === "mensual") return null;
  const price = computePrice(p);
  if (price == null) return null;
  const cost = p.cost == null ? null : Number(p.cost);
  if (cost == null) return price;
  return price - cost;
}

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

// Duración en minutos → "5 min" | "1h 30min" | "2h" | "—" si null.
// Acepta decimales: 1.5 → "1min 30s", 0.5 → "30s".
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const n = Number(minutes);
  if (Number.isNaN(n) || n < 0) return "—";

  const totalSeconds = Math.round(n * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}min`);
  if (hours === 0 && mins === 0 && secs > 0) parts.push(`${secs}s`);
  if (parts.length === 0) return "0 min";
  return parts.join(" ");
}
