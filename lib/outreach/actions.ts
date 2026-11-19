"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { assertScope } from "@/lib/auth/permissions";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";
import { OUTREACH_STATUSES, RESOURCE_KINDS, type OutreachStatus } from "./types";

/**
 * Escrituras de Outreach. Todas con la sesión del usuario (RLS por pestaña)
 * y detrás de assertScope("outreach").
 */

export type OutreachResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const uuid = z.string().uuid("ID inválido");
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "El color debe ser un hex como #aabbcc");
const optionalUrl = z
  .string()
  .trim()
  .url("Link inválido")
  .max(2000)
  .nullable()
  .or(z.literal("").transform(() => null));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

function revalidateOutreach() {
  revalidateTag(CACHE_TAGS.outreach, {});
  revalidatePath("/outreach");
  revalidatePath("/outreach/configuracion");
}

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos";
}

// ---------------------------------------------------------------------------
// Plantilla default
// ---------------------------------------------------------------------------

export async function updateDefaultTemplate(template: string): Promise<OutreachResult> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  const parsed = z.string().max(10000, "La plantilla es demasiado larga").safeParse(template);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const sb = await createClient();
  const { error } = await sb
    .from("outreach_settings")
    .upsert({ id: 1, default_template: parsed.data }, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  revalidateOutreach();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Plataformas
// ---------------------------------------------------------------------------

const platformSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Poné un nombre").max(60, "Nombre demasiado largo"),
  icon: z.string().trim().max(40).nullable(),
  color: hexColor,
  template: z.string().max(10000, "La plantilla es demasiado larga"),
});

export type PlatformInput = z.input<typeof platformSchema>;

/** Crea (sin id) o actualiza (con id) una plataforma. Devuelve el id. */
export async function savePlatform(input: PlatformInput): Promise<OutreachResult<{ id: string }>> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  const parsed = platformSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...fields } = parsed.data;

  const sb = await createClient();
  if (id) {
    const { error } = await sb.from("outreach_platforms").update(fields).eq("id", id);
    if (error) return { ok: false, error: dbError(error, "Ya existe una plataforma con ese nombre") };
    revalidateOutreach();
    return { ok: true, data: { id } };
  }

  // Al final de la lista.
  const { data: last } = await sb
    .from("outreach_platforms")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await sb
    .from("outreach_platforms")
    .insert({ ...fields, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: dbError(error, "Ya existe una plataforma con ese nombre") };
  revalidateOutreach();
  return { ok: true, data: { id: data.id } };
}

export async function deletePlatform(id: string): Promise<OutreachResult> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  const sb = await createClient();
  // Los mensajes registrados conservan platform_name (platform_id queda null).
  const { error } = await sb.from("outreach_platforms").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateOutreach();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Páginas y samples
// ---------------------------------------------------------------------------

const resourceSchema = z.object({
  id: uuid.optional(),
  kind: z.enum(RESOURCE_KINDS),
  name: z.string().trim().min(1, "Poné un nombre").max(80, "Nombre demasiado largo"),
  url: z.string().trim().url("Link inválido").max(2000),
  tag: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]+$/, "La etiqueta solo puede tener letras, números y guiones bajos")
    .max(60, "Etiqueta demasiado larga"),
  description: optionalText(500),
});

export type ResourceInput = z.input<typeof resourceSchema>;

export async function saveResource(input: ResourceInput): Promise<OutreachResult<{ id: string }>> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...fields } = parsed.data;

  const sb = await createClient();
  if (id) {
    const { error } = await sb.from("outreach_resources").update(fields).eq("id", id);
    if (error) return { ok: false, error: dbError(error, "Ya existe otro recurso con esa etiqueta") };
    revalidateOutreach();
    return { ok: true, data: { id } };
  }

  const { data: last } = await sb
    .from("outreach_resources")
    .select("sort_order")
    .eq("kind", fields.kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await sb
    .from("outreach_resources")
    .insert({ ...fields, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: dbError(error, "Ya existe otro recurso con esa etiqueta") };
  revalidateOutreach();
  return { ok: true, data: { id: data.id } };
}

export async function deleteResource(id: string): Promise<OutreachResult> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  const sb = await createClient();
  const { error } = await sb.from("outreach_resources").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateOutreach();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Registro de mensajes
// ---------------------------------------------------------------------------

const snapshotSchema = z.object({
  kind: z.enum(RESOURCE_KINDS),
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().max(2000),
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

const messageSchema = z.object({
  clientName: z.string().trim().min(1, "Poné el nombre del cliente").max(120),
  platformId: uuid.nullable(),
  message: z.string().trim().min(1, "El mensaje está vacío").max(20000),
  postUrl: optionalUrl,
  status: z.enum(OUTREACH_STATUSES),
  notes: optionalText(2000),
  resources: z.array(snapshotSchema).max(50),
  sentAt: dateSchema,
});

export type MessageInput = z.input<typeof messageSchema>;

/** Nombre de la plataforma para guardar de copia en el registro. */
async function platformNameOf(
  sb: Awaited<ReturnType<typeof createClient>>,
  platformId: string | null
): Promise<string> {
  if (!platformId) return "";
  const { data } = await sb.from("outreach_platforms").select("name").eq("id", platformId).maybeSingle();
  return data?.name ?? "";
}

export async function createOutreachMessage(input: MessageInput): Promise<OutreachResult<{ id: string }>> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;

  const sb = await createClient();
  const { data, error } = await sb
    .from("outreach_messages")
    .insert({
      client_name: d.clientName,
      platform_id: d.platformId,
      platform_name: await platformNameOf(sb, d.platformId),
      message: d.message,
      post_url: d.postUrl,
      status: d.status,
      notes: d.notes,
      resources: d.resources,
      sent_at: d.sentAt,
      created_by: guard.viewer.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateOutreach();
  return { ok: true, data: { id: data.id } };
}

export async function updateOutreachMessage(
  id: string,
  input: MessageInput
): Promise<OutreachResult> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;

  const sb = await createClient();
  const { error } = await sb
    .from("outreach_messages")
    .update({
      client_name: d.clientName,
      platform_id: d.platformId,
      platform_name: await platformNameOf(sb, d.platformId),
      message: d.message,
      post_url: d.postUrl,
      status: d.status,
      notes: d.notes,
      resources: d.resources,
      sent_at: d.sentAt,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateOutreach();
  return { ok: true };
}

export async function updateOutreachStatus(
  id: string,
  status: OutreachStatus
): Promise<OutreachResult> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  if (!z.enum(OUTREACH_STATUSES).safeParse(status).success) {
    return { ok: false, error: "Estado inválido" };
  }
  const sb = await createClient();
  const { error } = await sb.from("outreach_messages").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateOutreach();
  return { ok: true };
}

export async function deleteOutreachMessage(id: string): Promise<OutreachResult> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  const sb = await createClient();
  const { error } = await sb.from("outreach_messages").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateOutreach();
  return { ok: true };
}

// ---------------------------------------------------------------------------

function dbError(error: { code?: string; message: string }, uniqueMsg: string): string {
  return error.code === "23505" ? uniqueMsg : error.message;
}
