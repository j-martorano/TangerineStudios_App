/**
 * Catálogo de pestañas de la app. Es la fuente única para:
 *   - qué pestañas puede otorgar Joaco en /usuarios,
 *   - qué ítems muestra el sidebar,
 *   - qué ruta protege cada guard (`requireTab`).
 *
 * "usuarios" no está acá a propósito: es solo para admins y no se otorga.
 * Si se agrega una página nueva, se agrega acá y en su layout con
 * `requireTab(...)`; si no, nadie que no sea admin la ve.
 */
export const TABS = [
  { key: "dashboard", href: "/", label: "Dashboard", exact: true },
  { key: "kanban", href: "/kanban", label: "Kanban", exact: false },
  { key: "projects", href: "/projects", label: "Spreadsheet", exact: false },
  { key: "clients", href: "/clients", label: "Clientes", exact: false },
  { key: "editors", href: "/editors", label: "Editores", exact: false },
  { key: "finanzas", href: "/finanzas", label: "Finanzas", exact: false },
  { key: "facturas", href: "/facturas", label: "Facturas", exact: false },
  { key: "boveda", href: "/boveda", label: "Bóveda", exact: false },
  { key: "configuracion", href: "/configuracion", label: "Configuración", exact: false },
  { key: "mantenimiento", href: "/admin", label: "Mantenimiento", exact: false },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export const TAB_KEYS: readonly TabKey[] = TABS.map((t) => t.key);

export const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  dashboard: "Resumen del mes con cobrado, pagado y ganancia.",
  kanban: "Tablero de proyectos. Incluye montos del mes.",
  projects: "Tabla anual de todos los proyectos.",
  clients: "Clientes y sus precios.",
  editors: "Editores y lo que cobra cada uno.",
  finanzas: "Toda la plata: cobros, pagos y ganancia.",
  facturas: "Facturas emitidas y sus PDFs.",
  boveda: "Contraseñas compartidas. Cada una se habilita aparte.",
  configuracion: "Catálogos compartidos y datos de facturación.",
  mantenimiento: "Herramientas de mantenimiento (backfill de fechas).",
};

export function isTabKey(v: string): v is TabKey {
  return (TAB_KEYS as readonly string[]).includes(v);
}

export type Role = "admin" | "member";

/** Perfil reducido que viaja al cliente (sidebar). */
export type ViewerProfile = {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  tabs: TabKey[];
};

/** Pestañas efectivas: un admin ve todas. */
export function effectiveTabs(role: Role, allowed: readonly string[]): TabKey[] {
  if (role === "admin") return [...TAB_KEYS];
  return TAB_KEYS.filter((k) => allowed.includes(k));
}
