import type { Database } from "@/lib/database.types";

export type ProjectPhase = Database["public"]["Enums"]["project_phase"];
export type CobradoStatus = Database["public"]["Enums"]["cobrado_status"];
export type PagadoStatus = Database["public"]["Enums"]["pagado_status"];
export type InvoicedStatus = Database["public"]["Enums"]["invoiced_status"];

export type PaymentType = Database["public"]["Enums"]["payment_type"];
export type EditorPaymentType =
  Database["public"]["Enums"]["editor_payment_model"];

/** Tramo de FLAT variable: si la duración cae en [min, max), se cobra `amount`. */
export type PaymentTier = {
  min_minutes: number;
  max_minutes: number;
  amount: number;
};

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type EditorRow = Database["public"]["Tables"]["editors"]["Row"];

export type EditorMini = Pick<
  EditorRow,
  "id" | "name" | "payment_type" | "rate" | "flat_amount"
> & {
  /** Tramos de FLAT variable. Vacío para flat / por_minuto. */
  tiers: PaymentTier[];
};
export type ClientMini = Pick<
  ClientRow,
  | "id"
  | "name"
  | "color"
  | "payment_type"
  | "agreed_price"
  | "retainer_discount_pct"
>;

/**
 * Cliente con el saldo de minutos calculado. Sólo tiene sentido para clientes
 * mensuales (los demás traen `minute_balance: null`).
 */
export type ClientForProject = ClientMini & {
  minute_balance: number | null;
};

/** Pago de un cliente mensual: acredita `minutes_credited` minutos. */
export type ClientPayment = {
  id: string;
  amount: number;
  minutes_credited: number;
  paid_at: string;
  note: string | null;
};

/**
 * Config de pago del par cliente-editor. Cada par puede tener su propia
 * payment_type, rate, flat_amount, y para flat_variable, sus propios tramos.
 * Si payment_type es null, el par usa el modelo global del editor.
 */
export type ClientEditorPair = {
  client: ClientMini;
  payment_type: EditorPaymentType | null;
  rate: number | null;
  flat_amount: number | null;
  tiers: PaymentTier[];
};

export type ProjectEditorAssignment = {
  cost: number | null;
  editor: EditorMini | null;
};

export type ProjectWithRelations = ProjectRow & {
  client: ClientMini | null;
  editors: ProjectEditorAssignment[];
};

export const PROJECT_PHASES: ProjectPhase[] = [
  "por_asignar",
  "editando",
  "terminado",
];

export const COBRADO_STATUSES: CobradoStatus[] = ["no", "parcial", "si"];
export const PAGADO_STATUSES: PagadoStatus[] = [
  "sin_pagar",
  "parcial",
  "pago_total",
];
export const INVOICED_STATUSES: InvoicedStatus[] = ["no", "parcial", "si"];

export const PAYMENT_TYPES: PaymentType[] = [
  "por_proyecto",
  "por_rate",
  "mensual",
];

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  por_proyecto: "FLAT — precio fijo por proyecto",
  por_rate: "Por minuto",
  mensual: "RETAINER — paquete mensual con minutos",
};

export const EDITOR_PAYMENT_TYPES: EditorPaymentType[] = [
  "flat",
  "flat_variable",
  "por_minuto",
];

export const EDITOR_PAYMENT_TYPE_LABEL: Record<EditorPaymentType, string> = {
  flat: "FLAT — fijo por proyecto",
  flat_variable: "FLAT variable — por rango de minutos",
  por_minuto: "Por minuto",
};

// Nombres de los editores de un proyecto, en orden alfabético, unidos con " + ".
export function editorNames(p: ProjectWithRelations): string {
  const names = p.editors
    .map((e) => e.editor?.name)
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => a.localeCompare(b));
  return names.length > 0 ? names.join(" + ") : "—";
}

// Alias retrocompat para no romper código que aún usa el nombre viejo.
export type ProjectWithEditor = ProjectWithRelations;
