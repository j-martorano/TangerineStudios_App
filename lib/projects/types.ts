import type { Database } from "@/lib/database.types";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type CurrencyCode = Database["public"]["Enums"]["currency_code"];

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export type EditorMini = Pick<
  Database["public"]["Tables"]["editors"]["Row"],
  "id" | "name"
>;

export type ClientMini = Pick<
  Database["public"]["Tables"]["clients"]["Row"],
  "id" | "name"
>;

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
