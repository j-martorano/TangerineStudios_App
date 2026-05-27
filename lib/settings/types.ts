// Preferencias de usuario. Cada uno tiene las suyas guardadas en user_settings.
// Las cosas que afectan a TODOS (catálogos, datos) viven en otras tablas; acá
// va solo lo "personal": qué columnas ver, qué pestañas de Finanzas mostrar y
// los límites de paginación.

// ---- IDs de columnas por página ----

export const PROJECTS_COLUMNS = [
  "code",
  "title",
  "type",
  "client",
  "phase",
  "price",
  "cost",
  "profit",
  "duration",
  "editor",
  "cobrado",
  "pagado",
  "invoiced",
  "updated",
  "actions",
  "finalized",
] as const;
export type ProjectsColumnId = (typeof PROJECTS_COLUMNS)[number];

export const PROJECTS_COLUMN_LABEL: Record<ProjectsColumnId, string> = {
  code: "Código",
  title: "Título",
  type: "Tipo",
  client: "Cliente",
  phase: "Fase",
  price: "Precio",
  cost: "Costo",
  profit: "Ganancia",
  duration: "Duración",
  editor: "Editor",
  cobrado: "Cobrado",
  pagado: "Pagado",
  invoiced: "Facturado",
  updated: "Actualizado",
  actions: "Acciones",
  finalized: "Finalizado",
};

export const EDITORS_COLUMNS = [
  "name",
  "clients",
  "contact",
  "discord",
  "payment_methods",
  "docs",
  "projects",
  "actions",
] as const;
export type EditorsColumnId = (typeof EDITORS_COLUMNS)[number];

export const EDITORS_COLUMN_LABEL: Record<EditorsColumnId, string> = {
  name: "Nombre",
  clients: "Clientes",
  contact: "Contacto",
  discord: "Discord",
  payment_methods: "Métodos de pago",
  docs: "Docs",
  projects: "Proyectos",
  actions: "Acciones",
};

export const CLIENTS_COLUMNS = [
  "color",
  "name",
  "type",
  "minute_balance",
  "editors",
  "contact",
  "docs",
  "projects",
  "actions",
] as const;
export type ClientsColumnId = (typeof CLIENTS_COLUMNS)[number];

export const CLIENTS_COLUMN_LABEL: Record<ClientsColumnId, string> = {
  color: "Color",
  name: "Nombre",
  type: "Tipo",
  minute_balance: "Saldo minutos",
  editors: "Editores",
  contact: "Contacto",
  docs: "Docs",
  projects: "Proyectos",
  actions: "Acciones",
};

// ---- Pestañas de Finanzas ----

export const FINANZAS_TABS = [
  "resumen",
  "por_mes",
  "pagos",
  "por_proyecto",
  "cobros_pendientes",
  "servicios",
] as const;
export type FinanzasTabId = (typeof FINANZAS_TABS)[number];

export const FINANZAS_TAB_LABEL: Record<FinanzasTabId, string> = {
  resumen: "Resumen",
  por_mes: "Por mes",
  pagos: "Pagos retainer",
  por_proyecto: "Por proyecto",
  cobros_pendientes: "Cobros pendientes",
  servicios: "Servicios fijos",
};

// ---- Shape completa ----

export type UserPrefs = {
  columns: {
    projects: ProjectsColumnId[];
    editors: EditorsColumnId[];
    clients: ClientsColumnId[];
  };
  finanzas: {
    tabs: FinanzasTabId[];
  };
  limits: {
    projects_per_year: number;
    editors_per_page: number;
    clients_per_page: number;
  };
};

// Subset por default para la tabla de Proyectos: las columnas clave que se
// ven de un vistazo. El resto queda en el panel expandible (click en la fila).
// El usuario puede cambiar cuáles están visibles desde /configuracion.
const DEFAULT_PROJECTS_COLUMNS: ProjectsColumnId[] = [
  "code",
  "title",
  "type",
  "client",
  "price",
  "cost",
  "profit",
  "actions",
  "finalized",
];

export const DEFAULT_PREFS: UserPrefs = {
  columns: {
    projects: DEFAULT_PROJECTS_COLUMNS,
    editors: [...EDITORS_COLUMNS],
    clients: [...CLIENTS_COLUMNS],
  },
  finanzas: { tabs: [...FINANZAS_TABS] },
  limits: {
    projects_per_year: 100,
    editors_per_page: 20,
    clients_per_page: 20,
  },
};

/**
 * Garantiza que las columnas obligatorias del default (las que se agregaron
 * después de que el usuario guardó sus preferencias) estén presentes.
 * Inserta las nuevas columnas en la posición relativa correcta del default;
 * si no se puede inferir la posición, las agrega al final (antes de "actions").
 */
function ensureDefaultColumns(
  saved: ProjectsColumnId[],
  defaults: ProjectsColumnId[]
): ProjectsColumnId[] {
  const missing = defaults.filter((c) => !saved.includes(c));
  if (missing.length === 0) return saved;
  const result = [...saved];
  for (const col of missing) {
    const defaultIdx = defaults.indexOf(col);
    // Busca el primer vecino a la derecha que ya exista en result para insertar antes.
    const insertBefore = defaults
      .slice(defaultIdx + 1)
      .find((c) => result.includes(c));
    if (insertBefore) {
      result.splice(result.indexOf(insertBefore), 0, col);
    } else {
      // Fallback: agrega antes de "actions" si existe, si no al final.
      const actionsIdx = result.indexOf("actions");
      result.splice(actionsIdx >= 0 ? actionsIdx : result.length, 0, col);
    }
  }
  return result;
}

/** Mezcla preferencias parciales del DB con los defaults. */
export function mergePrefs(partial: Partial<UserPrefs> | null): UserPrefs {
  if (!partial) return DEFAULT_PREFS;
  return {
    columns: {
      projects: ensureDefaultColumns(
        partial.columns?.projects ?? DEFAULT_PREFS.columns.projects,
        DEFAULT_PREFS.columns.projects
      ),
      editors: partial.columns?.editors ?? DEFAULT_PREFS.columns.editors,
      clients: partial.columns?.clients ?? DEFAULT_PREFS.columns.clients,
    },
    finanzas: {
      tabs: partial.finanzas?.tabs ?? DEFAULT_PREFS.finanzas.tabs,
    },
    limits: {
      projects_per_year:
        partial.limits?.projects_per_year ??
        DEFAULT_PREFS.limits.projects_per_year,
      editors_per_page:
        partial.limits?.editors_per_page ??
        DEFAULT_PREFS.limits.editors_per_page,
      clients_per_page:
        partial.limits?.clients_per_page ??
        DEFAULT_PREFS.limits.clients_per_page,
    },
  };
}
