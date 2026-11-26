import { tagsIn } from "./render";
import type { OutreachResource } from "./types";

/**
 * Parte pura del modo IA de Outreach: cómo se arma lo que se le manda al
 * modelo y cómo se lee lo que devuelve. Sin red ni DB, así se prueba solo.
 *
 * La IA no escribe links: escribe etiquetas ({SAMPLE_X}, {PAGINA_Y}) donde
 * quiere que vaya cada uno y dice qué recursos eligió. Después el motor de
 * plantillas (render.ts) arma el mensaje final igual que a mano, y Copiar /
 * Registrar funcionan sin cambios.
 */

/**
 * Modelo por defecto y cadena de reserva (gemini.ts prueba uno tras otro).
 * Con la cuota gratuita los modelos nuevos viven saturados y Google retira
 * los viejos para cuentas nuevas (gemini-2.5-flash ya devuelve 404), así que
 * si algo cambia se actualiza acá sin tocar la DB.
 */
export const DEFAULT_AI_MODEL = "gemini-3.5-flash";
export const FALLBACK_AI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.7-flash"];

/** Instrucciones editables desde Configuración. Lo que no se puede tocar va en FORMAT_RULES. */
export const DEFAULT_AI_PROMPT = `Sos el asistente de outreach de Tangerine Studios, un estudio de edición de video. Escribís el primer mensaje a un potencial cliente a partir del contexto que te pasan (quién es, qué publicó, qué hace).

Cómo escribir:
- Tono cercano y profesional, de persona a persona, sin sonar a plantilla ni a vendedor. Corto: entre 80 y 150 palabras.
- Arrancá con algo concreto del cliente (qué publicó, qué hace, qué problema contó) y conectalo con lo que una buena edición le resolvería.
- El mensaje base es solo una referencia de estructura y de cómo se presenta el estudio: no lo copies, adaptalo al cliente.
- No prometas precios ni plazos. No inventes trabajos, clientes ni datos, y no digas que viste o seguís cosas del cliente que no estén en el contexto.

Cómo elegir páginas y samples:
- Leé el contexto de cada uno (rubro, estilo, tipo de video) y quedate con los que más se parezcan a lo que el cliente hace o necesita: primero por rubro, después por tipo de video, después por estilo.
- Mandá 1 o 2 samples como máximo. Si ninguno se parece de verdad al cliente, no fuerces uno: mandá solo la web o el portfolio general.
- Una sola página (la web o el portfolio), salvo que haya una específica del rubro del cliente.
- Presentá cada link con una frase que diga por qué le sirve a ese cliente, no como una lista suelta.`;

/** Reglas técnicas fijas: van siempre después del prompt de Joaco. */
export const FORMAT_RULES = `Formato de respuesta (obligatorio):
- Escribí el mensaje en el idioma que dice «Idioma del mensaje» en el pedido. El mensaje base puede estar en otro idioma: eso no importa, es solo referencia de estructura.
- Para poner el link de una página o sample escribí su etiqueta exacta entre llaves (por ejemplo {SAMPLE_TALKING_HEAD}) en el lugar del mensaje donde va. Nunca escribas URLs ni inventes etiquetas: solo las de la lista.
- Saludá con {NOMBRE} (se reemplaza por el nombre del cliente); no escribas el nombre a mano.
- Respondé en JSON con: "message" (el mensaje completo, con saltos de línea), "resourceTags" (las etiquetas de las páginas y samples que usaste, sin llaves) y "rationale" (una línea en español explicando por qué elegiste esos recursos).`;

/** Idioma del mensaje. «auto» = el del contexto del cliente. */
export const AI_LANGUAGES = [
  { value: "auto", label: "El del contexto" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
] as const;
export type AiLanguage = (typeof AI_LANGUAGES)[number]["value"];

const LANGUAGE_INSTRUCTION: Record<AiLanguage, string> = {
  auto: "el mismo idioma en que está escrito el contexto del cliente (si el contexto está en español, el mensaje va en español; si está en inglés, en inglés). Ignorá el idioma del mensaje base.",
  es: "español (rioplatense, con voseo). Aunque el contexto o el mensaje base estén en otro idioma.",
  en: "English. Even if the client context or the base message are in another language.",
};

export type AiPromptInput = {
  clientName: string;
  platformName: string;
  language?: AiLanguage;
  /** Mensaje base de la plataforma, como referencia de estilo ("" si no hay). */
  baseTemplate: string;
  /** Lo que pegó Joaco: el posteo, quién es el cliente, qué necesita. */
  context: string;
  resources: Pick<OutreachResource, "kind" | "name" | "url" | "tag" | "description">[];
};

export function buildSystemInstruction(customPrompt: string | null): string {
  const prompt = customPrompt?.trim() || DEFAULT_AI_PROMPT;
  return `${prompt}\n\n${FORMAT_RULES}`;
}

function resourceLines(items: AiPromptInput["resources"]): string {
  if (items.length === 0) return "(ninguno configurado)";
  return items
    .map((r) => `- {${r.tag}} · ${r.name}${r.description ? ` · ${r.description}` : " · (sin contexto)"}`)
    .join("\n");
}

/** Mensaje de usuario para el modelo: el caso concreto. */
export function buildUserPrompt(input: AiPromptInput): string {
  const pages = input.resources.filter((r) => r.kind === "pagina");
  const samples = input.resources.filter((r) => r.kind === "sample");
  const parts = [
    `Cliente: ${input.clientName.trim() || "(sin nombre todavía; usá {NOMBRE})"}`,
    `Plataforma donde se manda: ${input.platformName || "(sin especificar)"}`,
    `Idioma del mensaje: ${LANGUAGE_INSTRUCTION[input.language ?? "auto"]}`,
    "",
    "Mensaje base de esta plataforma (referencia de estilo y estructura):",
    '"""',
    input.baseTemplate.trim() || "(no hay mensaje base; escribilo desde cero)",
    '"""',
    "",
    "Páginas disponibles (etiqueta · nombre · contexto):",
    resourceLines(pages),
    "",
    "Samples disponibles (etiqueta · nombre · contexto):",
    resourceLines(samples),
    "",
    "Contexto del cliente:",
    '"""',
    input.context.trim(),
    '"""',
  ];
  return parts.join("\n");
}

/** JSON Schema (formato de Gemini) para forzar la respuesta estructurada. */
export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    message: { type: "STRING" },
    resourceTags: { type: "ARRAY", items: { type: "STRING" } },
    rationale: { type: "STRING" },
  },
  required: ["message", "resourceTags", "rationale"],
} as const;

export type AiGeneration = {
  /** Mensaje con etiquetas (va al editor de plantilla). */
  message: string;
  /** IDs de páginas y samples elegidos, en el orden en que aparecen en el mensaje. */
  resourceIds: string[];
  rationale: string;
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Interpreta la respuesta del modelo. Es tolerante: si escribió una URL de
 * un recurso en vez de la etiqueta, se reemplaza por la etiqueta; las
 * etiquetas que no existen se descartan de la lista (en el texto quedan
 * marcadas como sin resolver, para que se note).
 */
export function parseAiResponse(
  raw: string,
  resources: Pick<OutreachResource, "id" | "url" | "tag">[]
): AiGeneration {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    // Algunos modelos envuelven el JSON en ```json … ```.
    const m = /\{[\s\S]*\}/.exec(raw);
    if (!m) throw new Error("La IA no devolvió un mensaje válido");
    data = JSON.parse(m[0]);
  }
  if (!data || typeof data !== "object") throw new Error("La IA no devolvió un mensaje válido");
  const obj = data as Record<string, unknown>;
  let message = typeof obj.message === "string" ? obj.message.trim() : "";
  if (!message) throw new Error("La IA devolvió un mensaje vacío");

  // URLs crudas de recursos conocidos → su etiqueta.
  for (const r of resources) {
    const clean = r.url.replace(/\/+$/, "");
    if (!clean) continue;
    message = message.replace(new RegExp(`${escapeRe(clean)}/?(?![\\w/])`, "g"), `{${r.tag}}`);
  }
  message = message.replace(/\r\n/g, "\n");

  const byTag = new Map(resources.map((r) => [r.tag, r.id]));
  const ids: string[] = [];
  const add = (tag: string) => {
    const id = byTag.get(tag);
    if (id && !ids.includes(id)) ids.push(id);
  };
  for (const tag of tagsIn(message)) add(tag);
  const declared = Array.isArray(obj.resourceTags) ? obj.resourceTags : [];
  for (const t of declared) if (typeof t === "string") add(t.replace(/[{}]/g, "").trim().toUpperCase());

  return {
    message,
    resourceIds: ids,
    rationale: typeof obj.rationale === "string" ? obj.rationale.trim() : "",
  };
}
