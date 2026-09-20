import { currentMonthKeyAR } from "@/lib/argentina-date";
import type { ClientMini, CobradoStatus, ProjectPhase } from "./types";

/**
 * Regla ÚNICA de en qué mes cae un proyecto.
 *
 * La usan el kanban, la spreadsheet y finanzas. Si hay que cambiarla, se
 * cambia acá y los tres se mueven juntos — antes cada uno tenía su copia y se
 * desincronizaban.
 *
 * Criterio (decidido 2026-09-20):
 *   1. Retainer (cliente mensual): el ingreso entra por el pago mensual del
 *      cliente, no por el proyecto. Sin cobro que lo ancle, manda el mes en
 *      que se terminó.
 *   2. Resto: manda el COBRO. El proyecto entra al mes en que se cobró.
 *   3. Sin cobrar: mes actual, aunque esté terminado. Se arrastra mes a mes
 *      hasta que se registre el cobro, y recién ahí salta al mes que
 *      corresponde.
 *
 * Ojo: esto define dónde se MUESTRA la card. Los totales de plata se siguen
 * calculando aparte con las fechas reales de cada cobro y de cada pago a
 * editores, que pueden caer en meses distintos entre sí.
 */

/** "YYYY-MM" en UTC. "0000-00" si no hay fecha. */
export function monthKeyOfIso(iso: string | null | undefined): string {
  if (!iso) return "0000-00";
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Shape mínima que necesita la regla — sirve para cualquier proyecto. */
export type ProjectForBucket = {
  phase: ProjectPhase;
  finalized_at: string | null;
  created_at: string | null;
  cobrado: CobradoStatus;
  cobros: { paid_at: string }[];
  client: ClientMini | null;
};

/** Mes del cobro más reciente registrado, o null si no hay ninguno. */
export function latestCobroMonthKey(p: ProjectForBucket): string | null {
  if (p.cobros.length === 0) return null;
  const latest = p.cobros.reduce((a, b) => (b.paid_at > a.paid_at ? b : a));
  return latest.paid_at.slice(0, 7);
}

/** `true` si el proyecto ya tiene un mes propio; `false` si está esperando cobro. */
export function hasOwnMonth(p: ProjectForBucket): boolean {
  if (p.client?.payment_type === "mensual") {
    return p.phase === "terminado" && p.finalized_at != null;
  }
  return p.cobrado === "si";
}

export function projectEffectiveMonthKey(
  p: ProjectForBucket,
  currentMK: string = currentMonthKeyAR()
): string {
  // 1. Retainer → manda el mes de terminado.
  if (p.client?.payment_type === "mensual") {
    if (p.phase === "terminado" && p.finalized_at) {
      return monthKeyOfIso(p.finalized_at);
    }
    return currentMK;
  }

  // 2. Manda el cobro.
  if (p.cobrado === "si") {
    const cobroMK = latestCobroMonthKey(p);
    if (cobroMK) return cobroMK;
    // Marcado cobrado pero sin registro de cobro: no hay fecha real, así que
    // caemos a la mejor aproximación disponible.
    if (p.finalized_at) return monthKeyOfIso(p.finalized_at);
    if (p.created_at) return monthKeyOfIso(p.created_at);
    return currentMK;
  }

  // 3. Sin cobrar (terminado o no) → mes actual hasta que se cobre.
  return currentMK;
}
