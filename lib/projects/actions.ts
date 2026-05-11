"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES, PROJECT_STATUSES } from "./types";
import type { CurrencyCode, ProjectStatus } from "./types";

async function getClientName(clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();
  return data?.name ?? null;
}

const statusEnum = z.enum(
  PROJECT_STATUSES as [ProjectStatus, ...ProjectStatus[]]
);
const currencyEnum = z.enum(
  CURRENCIES as [CurrencyCode, ...CurrencyCode[]]
);

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const projectInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título es obligatorio")
    .max(120, "El título no puede tener más de 120 caracteres"),
  client_id: z.string().regex(uuidRegex, "Cliente inválido").nullable(),
  status: statusEnum,
  price: z
    .number()
    .nonnegative("El precio no puede ser negativo")
    .nullable(),
  currency: currencyEnum,
  editor_id: z.string().regex(uuidRegex, "Editor inválido").nullable(),
});

export type ProjectInput = z.input<typeof projectInputSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/kanban");
  revalidatePath("/projects");
  revalidatePath("/clients");
}

export async function createProject(
  input: ProjectInput
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const clientName = await getClientName(parsed.data.client_id);
  const { error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, client_name: clientName });

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function updateProject(
  id: string,
  input: ProjectInput
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const clientName = await getClientName(parsed.data.client_id);
  const { error } = await supabase
    .from("projects")
    .update({ ...parsed.data, client_name: clientName })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function changeStatus(
  id: string,
  status: ProjectStatus
): Promise<ActionResult> {
  const parsed = statusEnum.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Estado inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status: parsed.data })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export type ReorderUpdate = {
  id: string;
  status: ProjectStatus;
  position: number;
};

const reorderSchema = z.array(
  z.object({
    id: z.string().regex(uuidRegex, "ID inválido"),
    status: statusEnum,
    position: z.number().int().nonnegative(),
  })
);

export async function reorderProjects(
  updates: ReorderUpdate[]
): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(updates);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (parsed.data.length === 0) return { ok: true };

  const supabase = await createClient();
  const results = await Promise.all(
    parsed.data.map((u) =>
      supabase
        .from("projects")
        .update({ status: u.status, position: u.position })
        .eq("id", u.id)
    )
  );

  const failure = results.find((r) => r.error);
  if (failure?.error) return { ok: false, error: failure.error.message };

  revalidateAll();
  return { ok: true };
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos";
}
