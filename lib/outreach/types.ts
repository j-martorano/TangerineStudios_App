/**
 * Tipos y constantes de Outreach (mensajes para contactar leads).
 *
 * Las filas de la DB (`outreach_*`) se mapean a estos tipos en queries.ts;
 * los componentes y las actions solo hablan con estos.
 */

export const OUTREACH_STATUSES = [
  "enviado",
  "respondido",
  "interesado",
  "cliente",
  "descartado",
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const STATUS_LABEL: Record<OutreachStatus, string> = {
  enviado: "Enviado",
  respondido: "Respondió",
  interesado: "Interesado",
  cliente: "Cliente",
  descartado: "Descartado",
};

/** Clases del badge de estado (colores de marca sobre fondo oscuro). */
export const STATUS_CLASS: Record<OutreachStatus, string> = {
  enviado: "bg-white/10 text-white/70",
  respondido: "bg-[#37ACFF]/15 text-[#37ACFF]",
  interesado: "bg-[#FFAC37]/15 text-[#FFAC37]",
  cliente: "bg-[#37FF62]/15 text-[#37FF62]",
  descartado: "bg-[#FF3737]/15 text-[#FF3737]",
};

export function isOutreachStatus(v: string): v is OutreachStatus {
  return (OUTREACH_STATUSES as readonly string[]).includes(v);
}

export const RESOURCE_KINDS = ["pagina", "sample"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const KIND_LABEL: Record<ResourceKind, string> = {
  pagina: "Página",
  sample: "Sample",
};

export const KIND_LABEL_PLURAL: Record<ResourceKind, string> = {
  pagina: "Páginas",
  sample: "Samples",
};

/** Prefijo de la etiqueta de cada tipo: {PAGINA_…} / {SAMPLE_…}. */
export const KIND_TAG_PREFIX: Record<ResourceKind, string> = {
  pagina: "PAGINA",
  sample: "SAMPLE",
};

export function isResourceKind(v: string): v is ResourceKind {
  return (RESOURCE_KINDS as readonly string[]).includes(v);
}

export type OutreachPlatform = {
  id: string;
  name: string;
  /** key del catálogo de íconos (components/outreach/platform-icons.ts) */
  icon: string | null;
  color: string;
  /** Plantilla propia; vacía = usa la default. */
  template: string;
  sortOrder: number;
};

export type OutreachResource = {
  id: string;
  kind: ResourceKind;
  name: string;
  url: string;
  /** Sin llaves: PAGINA_TANGERINE_WEB. En la plantilla va {PAGINA_TANGERINE_WEB}. */
  tag: string;
  /** Qué muestra (para elegir a mano hoy y para la IA mañana). */
  description: string | null;
  sortOrder: number;
};

/** Copia de un recurso tal como se usó en un mensaje (sobrevive a borrados). */
export type ResourceSnapshot = {
  kind: ResourceKind;
  name: string;
  url: string;
};

export type OutreachMessage = {
  id: string;
  clientName: string;
  platformId: string | null;
  platformName: string;
  message: string;
  postUrl: string | null;
  status: OutreachStatus;
  notes: string | null;
  resources: ResourceSnapshot[];
  /** YYYY-MM-DD */
  sentAt: string;
  createdAt: string;
};

export type OutreachConfig = {
  platforms: OutreachPlatform[];
  resources: OutreachResource[];
  defaultTemplate: string;
};
