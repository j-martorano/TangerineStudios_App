/**
 * Catálogo de pestañas de la app. Es la fuente única para:
 *   - qué pestañas puede otorgar el admin en /usuarios,
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
  { key: "outreach", href: "/outreach", label: "Outreach", exact: false },
  { key: "clients", href: "/clients", label: "Clientes", exact: false },
  { key: "editors", href: "/editors", label: "Editores", exact: false },
  { key: "finanzas", href: "/finanzas", label: "Finanzas", exact: false },
  { key: "facturas", href: "/facturas", label: "Facturas", exact: false },
  { key: "boveda", href: "/boveda", label: "Bóveda", exact: false },
  { key: "configuracion", href: "/configuracion", label: "Configuración", exact: false },
  { key: "mantenimiento", href: "/admin", label: "Mantenimiento", exact: false },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/**
 * Pestañas que no se muestran en el menú ni se pueden otorgar: solo admins,
 * entrando por la URL. "mantenimiento" (/admin) es una herramienta de una
 * sola vez que no tiene sentido tener a la vista.
 */
export const HIDDEN_TABS: ReadonlySet<TabKey> = new Set<TabKey>(["mantenimiento"]);

/** Las pestañas que aparecen en el menú y en el formulario de permisos. */
export const VISIBLE_TABS = TABS.filter((t) => !HIDDEN_TABS.has(t.key));

export const TAB_KEYS: readonly TabKey[] = TABS.map((t) => t.key);

/**
 * Qué ve y qué puede tocar quien tiene cada pestaña. Lo lee el admin al dar
 * permisos, así que menciona lo que se "arrastra" (p. ej. el formulario de
 * proyecto deja crear clientes). Coincide con lib/auth/scopes.ts y con la
 * función SQL tabs_for.
 */
export const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  dashboard:
    "Resumen del mes con cobrado, pagado y ganancia. Puede crear proyectos y clientes.",
  kanban:
    "Tablero de proyectos con precios, costos y montos del mes. Mueve cards, marca cobros y pagos, y hace facturas.",
  projects:
    "Tabla anual de proyectos con precios y costos. Edita proyectos y puede crear clientes.",
  clients: "Clientes, precios acordados y pagos de retainer. Puede crear editores.",
  editors: "Editores, lo que cobra cada uno y su vínculo con Discord.",
  finanzas: "Toda la plata: cobros, pagos, ganancia y servicios fijos.",
  facturas: "Facturas emitidas y sus PDFs.",
  outreach:
    "Mensajes para contactar leads: arma el texto con páginas y samples, y lleva el registro de lo enviado.",
  boveda: "Contraseñas compartidas. Cada una se habilita aparte.",
  configuracion:
    "Métodos de pago, servicios fijos y datos de facturación del estudio.",
  mantenimiento: "Backfill de fechas de cobros y pagos.",
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

/** Pestañas efectivas: un admin ve todas; un usuario nunca ve las ocultas. */
export function effectiveTabs(role: Role, allowed: readonly string[]): TabKey[] {
  if (role === "admin") return [...TAB_KEYS];
  return TAB_KEYS.filter((k) => allowed.includes(k) && !HIDDEN_TABS.has(k));
}
