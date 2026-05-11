import type { Database } from "@/lib/database.types";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type CurrencyCode = Database["public"]["Enums"]["currency_code"];
export type PaymentType = Database["public"]["Enums"]["payment_type"];

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type EditorRow = Database["public"]["Tables"]["editors"]["Row"];

export type EditorMini = Pick<EditorRow, "id" | "name">;
export type ClientMini = Pick<ClientRow, "id" | "name" | "color">;

export const PAYMENT_TYPES: PaymentType[] = ["por_proyecto", "mensual"];

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  por_proyecto: "Por proyecto",
  mensual: "Mensual",
};

export type ProjectWithRelations = ProjectRow & {
  editor: EditorMini | null;
  client: ClientMini | null;
};

export const PROJECT_STATUSES: ProjectStatus[] = [
  "pending",
  "in_progress",
  "revising",
  "done",
  "invoiced",
];

export const CURRENCIES: CurrencyCode[] = ["ARS", "USD", "EUR"];

// Alias retrocompat (todavía se usa en algunos componentes hasta refactor completo)
export type ProjectWithEditor = ProjectWithRelations;
