import type { Database } from "@/lib/database.types";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export type EditorMini = Pick<
  Database["public"]["Tables"]["editors"]["Row"],
  "id" | "name"
>;

export type ProjectWithEditor = ProjectRow & {
  editor: EditorMini | null;
};

export const PROJECT_STATUSES: ProjectStatus[] = [
  "pending",
  "in_progress",
  "revising",
  "done",
  "invoiced",
];
