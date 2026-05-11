"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES, PROJECT_STATUSES } from "./types";
import type { CurrencyCode, ProjectStatus } from "./types";

const statusEnum = z.enum(
  PROJECT_STATUSES as [ProjectStatus, ...ProjectStatus[]]
);
const currencyEnum = z.enum(
  CURRENCIES as [CurrencyCode, ...CurrencyCode[]]
);

const projectInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título es obligatorio")
    .max(120, "El título no puede tener más de 120 caracteres"),
  client_id: z.string().uuid("Cliente inválido").nullable(),
  status: statusEnum,
  price: z
    .number()
    .nonnegative("El precio no puede ser negativo")
    .nullable(),
  currency: currencyEnum,
  editor_id: z.string().uuid("Editor inválido").nullable(),
});

export type ProjectInput = z.input<typeof projectInputSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createProject(
  input: ProjectInput
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert(parsed.data);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function updateProject(
  id: string,
  input: ProjectInput
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
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
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos";
}
