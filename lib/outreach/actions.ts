"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { assertScope } from "@/lib/auth/permissions";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createBotClient } from "@/lib/supabase/bot";
import { createClient } from "@/lib/supabase/server";
import { AI_LANGUAGES, DEFAULT_AI_MODEL, buildSystemInstruction, buildUserPrompt, parseAiResponse, type AiGeneration } from "./ai-prompt";
import { GeminiError, generateJson } from "./gemini";
import { fetchOutreachConfig } from "./queries";
import { templateFor } from "./render";
import { OUTREACH_STATUSES, RESOURCE_KINDS, type OutreachStatus } from "./types";

/**
 * Escrituras de Outreach. Todas con la sesión del usuario (RLS por pestaña)
 * y detrás de assertScope("outreach"). Los íconos van al bucket público
 * `outreach-icons` con service role (el bucket no tiene policies de escritura).
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

function dbError(error: { code?: string; message: string }, uniqueMsg: string): string {
  return error.code === "23505" ? uniqueMsg : error.message;
}

// ---------------------------------------------------------------------------
// Mensajes base (plantillas)
// ---------------------------------------------------------------------------

const templateSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Poné un nombre").max(60, "Nombre demasiado largo"),
  body: z.string().max(10000, "El mensaje es demasiado largo"),
});

export type TemplateInput = z.input<typeof templateSchema>;

/** Crea (sin id) o actualiza (con id) un mensaje base. */
export async function saveTemplate(input: TemplateInput): Promise<OutreachResult<{ id: string }>> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...fields } = parsed.data;

  const sb = await createClient();
  if (id) {
    const { error } = await sb.from("outreach_templates").update(fields).eq("id", id);
    if (error) return { ok: false, error: dbError(error, "Ya existe un mensaje con ese nombre") };
    revalidateOutreach();
    return { ok: true, data: { id } };
  }
  const { data: last } = await sb
    .from("outreach_templates")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await sb
    .from("outreach_templates")
    .insert({ ...fields, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: dbError(error, "Ya existe un mensaje con ese nombre") };

  // El primero que se crea pasa a ser el default general.
  const { data: settings } = await sb
    .from("outreach_settings")
    .select("default_template_id")
    .eq("id", 1)
    .maybeSingle();
  if (!settings || !settings.default_template_id) {
    await sb
      .from("outreach_settings")
      .upsert({ id: 1, default_template_id: data.id }, { onConflict: "id" });
  }
  revalidateOutreach();
  return { ok: true, data: { id: data.id } };
}

export async function deleteTemplate(id: string): Promise<OutreachResult> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  if (!uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  const sb = await createClient();
  // Las plataformas que lo usaban quedan con la default general (FK on delete set null).
  const { error } = await sb.from("outreach_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateOutreach();
  return { ok: true };
}

/** Qué mensaje base usan las plataformas que no eligieron uno propio. */
export async function setDefaultTemplate(id: string | null): Promise<OutreachResult> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "ID inválido" };
  const sb = await createClient();
  const { error } = await sb
    .from("outreach_settings")
    .upsert({ id: 1, default_template_id: id }, { onConflict: "id" });
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
  iconUrl: optionalUrl,
  color: hexColor,
  templateId: uuid.nullable(),
});

export type PlatformInput = z.input<typeof platformSchema>;

/** Crea (sin id) o actualiza (con id) una plataforma. Devuelve el id. */
export async function savePlatform(input: PlatformInput): Promise<OutreachResult<{ id: string }>> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  const parsed = platformSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, iconUrl, templateId, ...rest } = parsed.data;
  const fields = { ...rest, icon_url: iconUrl, template_id: templateId };

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
  iconUrl: optionalUrl,
  description: optionalText(500),
});

export type ResourceInput = z.input<typeof resourceSchema>;

export async function saveResource(input: ResourceInput): Promise<OutreachResult<{ id: string }>> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, iconUrl, ...rest } = parsed.data;
  const fields = { ...rest, icon_url: iconUrl };

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
// Íconos: subir una imagen o detectar el favicon de un link
// ---------------------------------------------------------------------------

const ICON_BUCKET = "outreach-icons";
const ICON_MAX_BYTES = 1024 * 1024;
const ICON_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/avif": "avif",
};

async function storeIcon(bytes: ArrayBuffer, contentType: string): Promise<OutreachResult<{ url: string }>> {
  const ext = ICON_TYPES[contentType.split(";")[0].trim().toLowerCase()];
  if (!ext) return { ok: false, error: `Formato de imagen no soportado (${contentType || "desconocido"})` };
  if (bytes.byteLength === 0) return { ok: false, error: "La imagen está vacía" };
  if (bytes.byteLength > ICON_MAX_BYTES) return { ok: false, error: "La imagen no puede pesar más de 1 MB" };

  const path = `${randomUUID()}.${ext}`;
  const sb = createBotClient();
  const { error } = await sb.storage
    .from(ICON_BUCKET)
    .upload(path, bytes, { contentType: contentType.split(";")[0].trim(), upsert: false });
  if (error) return { ok: false, error: `No se pudo guardar la imagen: ${error.message}` };
  const { data } = sb.storage.from(ICON_BUCKET).getPublicUrl(path);
  return { ok: true, data: { url: data.publicUrl } };
}

/** Sube una imagen (campo "file" del FormData) y devuelve su URL pública. */
export async function uploadIcon(formData: FormData): Promise<OutreachResult<{ url: string }>> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Falta la imagen" };
  return storeIcon(await file.arrayBuffer(), file.type);
}

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TangerineStudiosApp/1.0)",
        accept: init?.headers instanceof Headers ? (init.headers.get("accept") ?? "*/*") : "*/*",
        ...(init?.headers && !(init.headers instanceof Headers) ? init.headers : {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

/** Busca en el HTML los <link rel="icon"> y devuelve el mejor candidato. */
function iconLinksFrom(html: string, base: URL): string[] {
  const out: { href: string; score: number }[] = [];
  const linkRe = /<link\b[^>]*>/gi;
  for (const m of html.matchAll(linkRe)) {
    const tag = m[0];
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    if (!/\bicon\b|apple-touch-icon/.test(rel)) continue;
    const href = /\bhref\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (!href) continue;
    const sizes = /\bsizes\s*=\s*["']?(\d+)x\d+/i.exec(tag)?.[1];
    let score = sizes ? Math.min(Number(sizes), 512) : 32;
    if (rel.includes("apple-touch-icon")) score = Math.max(score, 180);
    if (/\.svg(\?|$)/i.test(href)) score += 1000;
    try {
      out.push({ href: new URL(href, base).toString(), score });
    } catch {
      // href roto: se ignora
    }
  }
  return out.sort((a, b) => b.score - a.score).map((c) => c.href);
}

/**
 * Detecta el ícono de una página (favicon, apple-touch-icon…), lo descarga y
 * lo guarda en el bucket. Si la página no se deja leer, usa el servicio de
 * favicons de Google como último recurso.
 */
export async function detectFavicon(pageUrl: string): Promise<OutreachResult<{ url: string }>> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  let base: URL;
  try {
    base = new URL(pageUrl.trim());
    if (base.protocol !== "http:" && base.protocol !== "https:") throw new Error();
  } catch {
    return { ok: false, error: "Link inválido" };
  }

  const candidates: string[] = [];
  try {
    const res = await fetchWithTimeout(base.toString(), 6000, { headers: { accept: "text/html,*/*" } });
    if (res.ok) {
      const html = (await res.text()).slice(0, 400_000);
      candidates.push(...iconLinksFrom(html, new URL(res.url || base.toString())));
    }
  } catch {
    // La página no responde o bloquea bots: probamos igual con /favicon.ico.
  }
  candidates.push(new URL("/favicon.ico", base).toString());
  candidates.push(
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(base.hostname)}&sz=128`
  );

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, 6000, { headers: { accept: "image/*,*/*" } });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength < 32) continue;
      const stored = await storeIcon(bytes, type || "image/x-icon");
      if (stored.ok) return stored;
    } catch {
      // siguiente candidato
    }
  }
  return { ok: false, error: "No se encontró un ícono para esa página. Podés subir uno a mano." };
}

// ---------------------------------------------------------------------------
// Registro de mensajes
// ---------------------------------------------------------------------------

const snapshotSchema = z.object({
  kind: z.enum(RESOURCE_KINDS),
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().max(2000),
  iconUrl: z.string().trim().max(2000).nullable().default(null),
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
// Modo IA (Gemini)
// ---------------------------------------------------------------------------

const aiSettingsSchema = z.object({
  /** Vacío = volver al prompt por defecto. */
  prompt: z.string().max(8000, "El prompt es demasiado largo"),
  /** Vacío = modelo por defecto. */
  model: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9.\-]*$/i, "Nombre de modelo inválido"),
});

export type AiSettingsInput = z.input<typeof aiSettingsSchema>;

/** Prompt y modelo de la IA. Texto vacío = usar el default del código. */
export async function saveAiSettings(input: AiSettingsInput): Promise<OutreachResult> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const sb = await createClient();
  const { error } = await sb
    .from("outreach_settings")
    .upsert(
      { id: 1, ai_prompt: parsed.data.prompt.trim() || null, ai_model: parsed.data.model || null },
      { onConflict: "id" }
    );
  if (error) return { ok: false, error: error.message };
  revalidateOutreach();
  return { ok: true };
}

const generateSchema = z.object({
  clientName: z.string().trim().max(120),
  platformId: uuid.nullable(),
  context: z
    .string()
    .trim()
    .min(1, "Pegá algo de contexto del cliente: el posteo, quién es, qué hace")
    .max(20000, "El contexto es demasiado largo"),
  /** auto = el del contexto del cliente. */
  language: z.enum(AI_LANGUAGES.map((l) => l.value) as [string, ...string[]]).default("auto"),
  /** Mensaje base elegido en el constructor; si no viene, el de la plataforma. "" = sin referencia. */
  baseTemplate: z.string().max(8000).optional(),
});

export type GenerateInput = z.input<typeof generateSchema>;

/**
 * Le pide a Gemini un mensaje para este lead. Devuelve el mensaje con
 * etiquetas (va al editor de plantilla) y los recursos que eligió; el
 * mensaje final lo arma el constructor como siempre.
 */
export async function generateOutreachMessage(input: GenerateInput): Promise<OutreachResult<AiGeneration>> {
  const guard = await assertScope("outreach");
  if (!guard.ok) return guard;
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;

  const config = await fetchOutreachConfig();
  const platform = config.platforms.find((p) => p.id === d.platformId) ?? null;
  const userPrompt = buildUserPrompt({
    clientName: d.clientName,
    platformName: platform?.name ?? "",
    baseTemplate: d.baseTemplate ?? templateFor(platform, config),
    context: d.context,
    language: d.language as (typeof AI_LANGUAGES)[number]["value"],
    resources: config.resources,
  });

  try {
    const raw = await generateJson({
      model: config.aiModel?.trim() || DEFAULT_AI_MODEL,
      systemInstruction: buildSystemInstruction(config.aiPrompt),
      userPrompt,
    });
    return { ok: true, data: parseAiResponse(raw, config.resources) };
  } catch (e) {
    if (e instanceof GeminiError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo generar el mensaje" };
  }
}
