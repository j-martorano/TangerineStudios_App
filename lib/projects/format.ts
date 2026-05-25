import type {
  ClientMini,
  CobradoStatus,
  EditorMini,
  InvoicedStatus,
  PagadoStatus,
  PaymentTier,
  ProjectEditorAssignment,
  ProjectPhase,
} from "./types";

type ProjectForCalc = {
  /** Override total del costo del proyecto (independiente de los editores). */
  cost: number | null;
  duration_minutes: number | null;
  price: number | null; // override manual; usado sólo para client.payment_type='por_proyecto'
  client: ClientMini | null;
  editors: ProjectEditorAssignment[];
  /** Si el proyecto es un pack, sus shorts hijos suman al cost agregado. */
  children?: ProjectForCalc[];
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

/**
 * Monto del tramo FLAT variable en el que cae `duration`.
 * Selección por límite inferior inclusivo: gana el último tramo cuyo
 * `min_minutes` sea ≤ duration. Si la duración queda por debajo del primer
 * tramo se usa el primero; por encima del último, el último (tramo más
 * cercano). Devuelve null si el editor no tiene tramos cargados.
 */
function tierAmount(
  tiers: PaymentTier[],
  duration: number
): number | null {
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort(
    (a, b) => Number(a.min_minutes) - Number(b.min_minutes)
  );
  let chosen = sorted[0];
  for (const tier of sorted) {
    if (duration >= Number(tier.min_minutes)) chosen = tier;
    else break;
  }
  return Number(chosen.amount);
}

/** Aporte de un editor al costo del proyecto según su modelo de pago. */
function editorCost(
  editor: EditorMini,
  duration: number | null
): number | null {
  switch (editor.payment_type) {
    case "flat":
      return editor.flat_amount == null ? null : Number(editor.flat_amount);
    case "por_minuto":
      if (editor.rate == null || duration == null) return null;
      return Number(editor.rate) * duration;
    case "flat_variable":
      if (duration == null) return null;
      return tierAmount(editor.tiers ?? [], duration);
    default:
      return null;
  }
}

/**
 * Costo calculado del proyecto. Cascada:
 *   1. Si el proyecto tiene `cost` cargado → ese es el total (override manual).
 *   2. Si es un pack (children populated), suma el costo de cada hijo +
 *      los editores propios del pack.
 *   3. Si no, sumamos el aporte de cada editor:
 *      a. Si la asignación tiene `cost` manual → ese valor.
 *      b. Si no, se calcula desde el modelo de pago del editor.
 * Si nada aporta cost computable, devolvemos null.
 */
export function computeCost(p: ProjectForCalc): number | null {
  if (p.cost != null) return Number(p.cost);

  const duration =
    p.duration_minutes == null ? null : Number(p.duration_minutes);
  let total = 0;
  let anyContribution = false;

  // Editores propios del proyecto (pack o no).
  for (const entry of p.editors) {
    let cost: number | null;
    if (entry.cost != null) {
      cost = Number(entry.cost);
    } else if (entry.editor) {
      cost = editorCost(entry.editor, duration);
    } else {
      cost = null;
    }
    if (cost == null) continue;
    total += cost;
    anyContribution = true;
  }

  // Si es un pack, sumamos el costo agregado de los hijos.
  if (p.children && p.children.length > 0) {
    for (const child of p.children) {
      const cc = computeCost(child);
      if (cc == null) continue;
      total += cc;
      anyContribution = true;
    }
  }

  return anyContribution ? total : null;
}

/**
 * Cost atribuido a UN editor específico dentro de un proyecto. Mira primero
 * el cost manual de la asignación; si es null, computa desde el modelo de
 * pago del editor con la duración del proyecto.
 */
export function editorCostInProject(
  p: ProjectForCalc,
  editorId: string
): number | null {
  const entry = p.editors.find((e) => e.editor?.id === editorId);
  if (!entry) return null;
  if (entry.cost != null) return Number(entry.cost);
  if (!entry.editor) return null;
  const duration =
    p.duration_minutes == null ? null : Number(p.duration_minutes);
  return editorCost(entry.editor, duration);
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
  en_revision: "En revisión",
  terminado: "Terminado",
};

export const PHASE_CLASS: Record<ProjectPhase, string> = {
  por_asignar:
    "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300",
  editando: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  en_revision:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
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

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
});

// Moneda única: todos los montos en USD.
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "code",
  maximumFractionDigits: 0,
});

export function formatPrice(price: number | string | null): string {
  if (price == null) return "—";
  const n = typeof price === "string" ? Number(price) : price;
  if (Number.isNaN(n)) return "—";
  return usdFormatter.format(n);
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
