import type { Database } from "@/lib/database.types";

export type ProjectPhase = Database["public"]["Enums"]["project_phase"];
export type CobradoStatus = Database["public"]["Enums"]["cobrado_status"];
export type PagadoStatus = Database["public"]["Enums"]["pagado_status"];
export type InvoicedStatus = Database["public"]["Enums"]["invoiced_status"];
export type EditorRole = Database["public"]["Enums"]["editor_role"];

export type CurrencyCode = Database["public"]["Enums"]["currency_code"];
export type PaymentType = Database["public"]["Enums"]["payment_type"];

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type EditorRow = Database["public"]["Tables"]["editors"]["Row"];

export type EditorMini = Pick<EditorRow, "id" | "name">;
export type ClientMini = Pick<
  ClientRow,
  "id" | "name" | "color" | "payment_type" | "agreed_price" | "balance"
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

export const CURRENCIES: CurrencyCode[] = ["ARS", "USD", "EUR"];

export const PAYMENT_TYPES: PaymentType[] = ["por_proyecto", "mensual"];

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  por_proyecto: "Por proyecto",
  mensual: "Mensual",
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
