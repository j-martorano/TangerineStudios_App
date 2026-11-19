import {
  KIND_TAG_PREFIX,
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

const TAG_RE = /\{([A-Z0-9_]+)\}/g;

/** Plantilla efectiva: la de la plataforma si tiene, si no la default. */
export function templateFor(
  platform: Pick<OutreachPlatform, "template"> | null | undefined,
  defaultTemplate: string
): string {
  const own = platform?.template ?? "";
  return own.trim() ? own : defaultTemplate;
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

function listLines(items: RenderContext["selected"]): string {
  return items.map((r) => `${r.name}: ${r.url}`).join("\n");
}

export function renderMessage(template: string, ctx: RenderContext): string {
  const pages = ctx.selected.filter((r) => r.kind === "pagina");
  const samples = ctx.selected.filter((r) => r.kind === "sample");
  const byTag = new Map(ctx.all.map((r) => [r.tag, r.url]));

  const lists: Record<string, string> = {
    PAGINAS: listLines(pages),
    SAMPLES: listLines(samples),
  };

  const lines = template.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Línea que es solo una lista vacía: se va entera.
    const soloTag = /^\{(PAGINAS|SAMPLES)\}$/.exec(trimmed);
    if (soloTag && lists[soloTag[1]] === "") continue;

    out.push(
      line.replace(TAG_RE, (whole, tag: string) => {
        if (tag === "NOMBRE") return ctx.clientName;
        if (tag === "PLATAFORMA") return ctx.platformName;
        if (tag in lists) return lists[tag];
        const url = byTag.get(tag);
        return url ?? whole;
      })
    );
  }
  // Las líneas borradas no deberían dejar más de un renglón en blanco.
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
