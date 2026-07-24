/**
 * Tags de caché compartidos entre queries (unstable_cache) y actions
 * (revalidateTag). Modificar un tag acá afecta toda la cadena automáticamente.
 */
export const CACHE_TAGS = {
  projects:  "projects",
  clients:   "clients",
  editors:   "editors",
  finanzas:  "finanzas",
  invoices:  "invoices",
  settings:  "settings",
  templates: "templates",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
