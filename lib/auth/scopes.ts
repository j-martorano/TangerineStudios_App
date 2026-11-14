import type { TabKey } from "./tabs";

/**
 * Qué pestañas habilitan cada grupo de server actions.
 *
 * Una server action se puede llamar a mano desde el navegador aunque el botón
 * no se vea, así que cada action chequea su scope con `assertAnyTab()`.
 * Las mismas reglas están en la base (función SQL `tabs_for` en la migración
 * 20261113000000_usuarios_permisos_boveda.sql) para quien le pegue directo a
 * la API de Supabase. Allá "crear" ('insert') está separado de "editar y
 * borrar" ('write'): p. ej. clientCreate es el 'insert' de clients y
 * clientEdit su 'write'. ⚠️ Si cambiás algo acá, cambialo allá también.
 */
export const SCOPES = {
  /** Proyectos, cobros y pagos de proyectos (kanban, spreadsheet, dashboard, finanzas, facturas). */
  projects: ["dashboard", "kanban", "projects", "finanzas", "facturas"],
  /** Crear un cliente (también desde el formulario de proyecto y el de editor). */
  clientCreate: ["dashboard", "kanban", "projects", "clients", "editors"],
  /** Editar o borrar un cliente. */
  clientEdit: ["clients"],
  /** Pagos de retainer y débitos de minutos. */
  clientPayments: ["dashboard", "kanban", "projects", "clients", "finanzas"],
  /** Crear un editor (también desde el formulario de cliente). */
  editorCreate: ["dashboard", "clients", "editors"],
  /** Editar, borrar, deshabilitar o vincular a Discord un editor. */
  editorEdit: ["editors"],
  /** Catálogo de métodos de pago. */
  paymentMethods: ["editors", "configuracion"],
  /** Servicios fijos del mes. */
  fixedServices: ["finanzas", "configuracion"],
  /** Facturas y sus PDFs. */
  invoices: ["kanban", "facturas"],
  /** Datos de facturación del estudio. */
  invoiceSettings: ["configuracion"],
  /** Plantillas de proyecto y subclientes (formulario de proyecto). */
  projectForm: ["dashboard", "kanban", "projects", "clients"],
  /** Backfill de fechas. */
  maintenance: ["mantenimiento"],
} as const satisfies Record<string, readonly TabKey[]>;

export type Scope = keyof typeof SCOPES;
