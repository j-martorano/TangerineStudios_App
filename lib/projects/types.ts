import type { Database } from "@/lib/database.types";

export type ProjectPhase = Database["public"]["Enums"]["project_phase"];
export type CobradoStatus = Database["public"]["Enums"]["cobrado_status"];
export type PagadoStatus = Database["public"]["Enums"]["pagado_status"];
export type InvoicedStatus = Database["public"]["Enums"]["invoiced_status"];
export type EditorRole = Database["public"]["Enums"]["editor_role"];

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
  | "monthly_fee"
  | "balance"
>;

export type ProjectEditorAssignment = {
  role: EditorRole;
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
  por_proyecto: "Precio por proyecto (manual)",
  por_rate: "Por rate × duración",
  mensual: "Mensual fijo",
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

// Helpers para extraer editor principal / segundo desde el array.
export function getPrimaryEditor(
  p: ProjectWithRelations
): ProjectEditorAssignment | null {
  return p.editors.find((e) => e.role === "primary") ?? null;
}

export function getSecondaryEditor(
  p: ProjectWithRelations
): ProjectEditorAssignment | null {
  return p.editors.find((e) => e.role === "secondary") ?? null;
}

// Alias retrocompat para no romper código que aún usa el nombre viejo.
export type ProjectWithEditor = ProjectWithRelations;
