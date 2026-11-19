import {
  KIND_TAG_PREFIX,
  type OutreachConfig,
  type OutreachPlatform,
  type OutreachResource,
  type ResourceKind,
} from "./types";

/**
 * Motor de plantillas de Outreach. Es puro (sin DB ni React) a propósito: lo
 * usa el constructor de mensajes hoy y lo va a usar el generador con IA
 * mañana (la IA elige recursos y texto; esto arma el mensaje final).
 *
 * Etiquetas que entiende una plantilla:
 *   {NOMBRE}       nombre del cliente / lead
 *   {PLATAFORMA}   nombre de la plataforma elegida
 *   {PAGINAS}      las páginas elegidas, una por línea ("Nombre: link")
 *   {SAMPLES}      los samples elegidos, una por línea ("Nombre: link")
 *   {PAGINA_X}     el link de esa página puntual, siempre (esté elegida o no)
 *   {SAMPLE_X}     ídem para un sample
 *
 * Si {PAGINAS} o {SAMPLES} queda vacío y está solo en su línea, la línea se
 * borra. Una etiqueta que no existe se deja como está, para que se note.
 */

export type RenderContext = {
  clientName: string;
  platformName: string;
  /** Recursos elegidos para este mensaje, en orden. */
  selected: Pick<OutreachResource, "kind" | "name" | "url">[];
  /** Todos los recursos configurados (para las etiquetas puntuales). */
  all: Pick<OutreachResource, "tag" | "url">[];
};

export const FIXED_TAGS: readonly { tag: string; help: string }[] = [
  { tag: "NOMBRE", help: "Nombre del cliente o lead" },
  { tag: "PLATAFORMA", help: "Nombre de la plataforma elegida" },
  { tag: "PAGINAS", help: "Las páginas elegidas, una por línea (Nombre: link)" },
  { tag: "SAMPLES", help: "Los samples elegidos, uno por línea (Nombre: link)" },
];

const FIXED_TAG_SET = new Set(FIXED_TAGS.map((t) => t.tag));
const TAG_RE = /\{([A-Z0-9_]+)\}/g;

/**
 * Plantilla efectiva de una plataforma: la suya si eligió una, si no la
 * default general. Devuelve el cuerpo ("" si no hay ninguna).
 */
export function templateFor(
  platform: Pick<OutreachPlatform, "templateId"> | null | undefined,
  config: Pick<OutreachConfig, "templates" | "defaultTemplateId">
): string {
  const id = platform?.templateId ?? config.defaultTemplateId;
  return config.templates.find((t) => t.id === id)?.body ?? "";
}

/**
 * Etiqueta a partir del nombre: "Talking-head" → SAMPLE_TALKING_HEAD.
 * Sin acentos, solo A-Z, 0-9 y guiones bajos.
 */
export function tagFor(kind: ResourceKind, name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `${KIND_TAG_PREFIX[kind]}_${slug}` : KIND_TAG_PREFIX[kind];
}

/** Etiquetas (sin llaves) que usa una plantilla, sin repetir. */
export function tagsIn(template: string): string[] {
  const out = new Set<string>();
  for (const m of template.matchAll(TAG_RE)) out.add(m[1]);
  return [...out];
}

/** Pedazo de una plantilla: texto suelto o una etiqueta (conocida o no). */
export type TemplateSegment =
  | { kind: "text"; text: string }
  | { kind: "tag"; text: string; tag: string; known: boolean };

/** Parte la plantilla en texto y etiquetas, para pintarlas en el editor. */
export function templateSegments(
  template: string,
  knownTags: Iterable<string>
): TemplateSegment[] {
  const known = new Set<string>([...FIXED_TAG_SET, ...knownTags]);
  const out: TemplateSegment[] = [];
  let last = 0;
  for (const m of template.matchAll(TAG_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: template.slice(last, at) });
    out.push({ kind: "tag", text: m[0], tag: m[1], known: known.has(m[1]) });
    last = at + m[0].length;
  }
  if (last < template.length) out.push({ kind: "text", text: template.slice(last) });
  return out;
}

/** Pedazo del mensaje final: texto suelto, un valor que vino de una etiqueta, o una etiqueta sin resolver. */
export type RenderedSegment =
  | { kind: "text"; text: string }
  | { kind: "value"; text: string; tag: string }
  | { kind: "unresolved"; text: string; tag: string };

function listLines(items: RenderContext["selected"]): string {
  return items.map((r) => `${r.name}: ${r.url}`).join("\n");
}

/**
 * Arma el mensaje final como segmentos (para mostrar qué se reemplazó).
 * `renderMessage` es lo mismo pero en texto plano.
 */
export function renderSegments(template: string, ctx: RenderContext): RenderedSegment[] {
  const pages = ctx.selected.filter((r) => r.kind === "pagina");
  const samples = ctx.selected.filter((r) => r.kind === "sample");
  const byTag = new Map(ctx.all.map((r) => [r.tag, r.url]));
  const lists: Record<string, string> = {
    PAGINAS: listLines(pages),
    SAMPLES: listLines(samples),
  };

  const out: RenderedSegment[] = [];
  const push = (seg: RenderedSegment) => {
    const prev = out[out.length - 1];
    if (seg.kind === "text" && prev?.kind === "text") prev.text += seg.text;
    else out.push(seg);
  };

  const lines = template.split(/\r?\n/);
  let blankRun = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    // Línea que es solo una lista vacía: se va entera.
    const soloTag = /^\{(PAGINAS|SAMPLES)\}$/.exec(trimmed);
    if (soloTag && lists[soloTag[1]] === "") continue;

    // Las líneas borradas no deberían dejar más de un renglón en blanco.
    if (trimmed === "") {
      blankRun += 1;
      if (blankRun > 1) continue;
    } else {
      blankRun = 0;
    }

    if (out.length > 0) push({ kind: "text", text: "\n" });
    let last = 0;
    for (const m of line.matchAll(TAG_RE)) {
      const at = m.index ?? 0;
      if (at > last) push({ kind: "text", text: line.slice(last, at) });
      const tag = m[1];
      if (tag === "NOMBRE") push({ kind: "value", text: ctx.clientName, tag });
      else if (tag === "PLATAFORMA") push({ kind: "value", text: ctx.platformName, tag });
      else if (tag in lists) push({ kind: "value", text: lists[tag], tag });
      else if (byTag.has(tag)) push({ kind: "value", text: byTag.get(tag)!, tag });
      else push({ kind: "unresolved", text: m[0], tag });
      last = at + m[0].length;
    }
    if (last < line.length) push({ kind: "text", text: line.slice(last) });
  }
  return out;
}

export function renderMessage(template: string, ctx: RenderContext): string {
  return renderSegments(template, ctx)
    .map((s) => s.text)
    .join("");
}
