import type {
  ClientMini,
  CobradoStatus,
  CurrencyCode,
  InvoicedStatus,
  PagadoStatus,
  ProjectEditorAssignment,
  ProjectPhase,
} from "./types";

type ProjectForCalc = {
  duration_minutes: number | null;
  price: number | null; // override manual; usado sólo para client.payment_type='por_proyecto'
  client: ClientMini | null;
  editors: ProjectEditorAssignment[];
};

// Precio calculado del proyecto según el payment_type del cliente:
//   - por_proyecto : project.price (manual)
//   - por_rate     : client.agreed_price * duration_minutes
//   - mensual      : null (la facturación va a nivel mes en Finanzas)
//   - sin cliente o sin datos suficientes: null
export function computePrice(p: ProjectForCalc): number | null {
  const client = p.client;
  if (!client) return null;
  if (client.payment_type === "por_proyecto") {
    return p.price == null ? null : Number(p.price);
  }
  if (client.payment_type === "por_rate") {
    if (client.agreed_price == null) return null;
    if (p.duration_minutes == null) return null;
    return Number(client.agreed_price) * Number(p.duration_minutes);
  }
  // mensual
  return null;
}

// Costo calculado del proyecto: suma de aportes de cada editor según su
// payment_type:
//   - por_rate : editor.rate * duration_minutes
//   - mensual  : 0 (salario fijo a nivel mes, no aporta al cost del proyecto)
// Si falta duration o rate para un editor por_rate, ese editor aporta null
// (no se suma, pero tampoco rompe el total).
export function computeCost(p: ProjectForCalc): number | null {
  const duration = p.duration_minutes == null ? null : Number(p.duration_minutes);
  let total = 0;
  let anyContribution = false;
  for (const entry of p.editors) {
    const editor = entry.editor;
    if (!editor) continue;
    if (editor.payment_type === "mensual") continue; // no aporta al proyecto
    if (editor.rate == null || duration == null) continue;
    total += Number(editor.rate) * duration;
    anyContribution = true;
  }
  return anyContribution ? total : null;
}

// Ganancia calculada del proyecto:
//   - por_proyecto / por_rate: precio - costo
//   - mensual: null (la ganancia real se calcula a nivel mes en Finanzas)
// Si falta precio o costo, retorna null.
export function computeProfit(p: ProjectForCalc): number | null {
  const client = p.client;
  if (!client) return null;
  if (client.payment_type === "mensual") return null;
  const price = computePrice(p);
  if (price == null) return null;
  const cost = computeCost(p);
  if (cost == null) return price; // si no hay editores con rate, ganancia = precio
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
