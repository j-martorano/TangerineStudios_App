"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { ClientMini } from "@/lib/projects/types";

const nameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio")
  .max(120, "El nombre no puede tener más de 120 caracteres");

const clientInputSchema = z.object({ name: nameSchema });

export type ClientInput = z.input<typeof clientInputSchema>;

export type ClientActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type ClientCreateResult =
  | { ok: true; client: ClientMini }
  | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/kanban");
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos";
}

export async function createClient(
  input: ClientInput
): Promise<ClientCreateResult> {
  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ name: parsed.data.name })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un cliente con ese nombre" };
    }
    return { ok: false, error: error.message };
  }

  revalidateAll();
  return { ok: true, client: data as ClientMini };
}

export async function updateClient(
  id: string,
  input: ClientInput
): Promise<ClientActionResult> {
  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({ name: parsed.data.name })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un cliente con ese nombre" };
    }
    return { ok: false, error: error.message };
  }

  revalidateAll();
  return { ok: true };
}

export async function deleteClient(id: string): Promise<ClientActionResult> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}
