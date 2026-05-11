"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { EditorMini } from "@/lib/projects/types";

const editorInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "El nombre no puede tener más de 120 caracteres"),
  email: z
    .union([z.string().email("Email inválido"), z.literal(""), z.null()])
    .default(null),
  phone: z.string().nullable().default(null),
  discord_id: z.string().nullable().default(null),
  bank_info: z.string().nullable().default(null),
  docs_url: z
    .union([z.string().url("URL inválida"), z.literal(""), z.null()])
    .default(null),
  /** IDs de clientes asignados. Si está definido, se sincroniza la pivot client_editors. */
  client_ids: z.array(z.string()).optional(),
});

export type EditorInput = z.input<typeof editorInputSchema>;

export type EditorActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type EditorCreateResult =
  | { ok: true; editor: EditorMini }
  | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/kanban");
  revalidatePath("/editors");
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos";
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function syncEditorClients(
  editorId: string,
  clientIds: string[] | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (clientIds === undefined) return { ok: true };
  const supabase = await createSupabaseClient();

  const { error: delErr } = await supabase
    .from("client_editors")
    .delete()
    .eq("editor_id", editorId);
  if (delErr) return { ok: false, error: delErr.message };

  if (clientIds.length === 0) return { ok: true };

  const { error: insErr } = await supabase
    .from("client_editors")
    .insert(clientIds.map((cid) => ({ client_id: cid, editor_id: editorId })));
  if (insErr) return { ok: false, error: insErr.message };

  return { ok: true };
}

export async function createEditor(
  input: EditorInput
): Promise<EditorCreateResult> {
  const parsed = editorInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("editors")
    .insert({
      name: parsed.data.name,
      email: normalizeText(parsed.data.email),
      phone: normalizeText(parsed.data.phone),
      discord_id: normalizeText(parsed.data.discord_id),
      bank_info: normalizeText(parsed.data.bank_info),
      docs_url: normalizeText(parsed.data.docs_url),
    })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un editor con ese Discord ID" };
    }
    return { ok: false, error: error.message };
  }

  const sync = await syncEditorClients(data.id, parsed.data.client_ids);
  if (!sync.ok) return { ok: false, error: sync.error };

  revalidateAll();
  return { ok: true, editor: data as EditorMini };
}

export async function updateEditor(
  id: string,
  input: EditorInput
): Promise<EditorActionResult> {
  const parsed = editorInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("editors")
    .update({
      name: parsed.data.name,
      email: normalizeText(parsed.data.email),
      phone: normalizeText(parsed.data.phone),
      discord_id: normalizeText(parsed.data.discord_id),
      bank_info: normalizeText(parsed.data.bank_info),
      docs_url: normalizeText(parsed.data.docs_url),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un editor con ese Discord ID" };
    }
    return { ok: false, error: error.message };
  }

  const sync = await syncEditorClients(id, parsed.data.client_ids);
  if (!sync.ok) return { ok: false, error: sync.error };

  revalidateAll();
  return { ok: true };
}

export async function deleteEditor(id: string): Promise<EditorActionResult> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("editors").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}
