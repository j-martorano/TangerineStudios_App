/**
 * kanban-card-styles.ts
 * Estilos aislados de las cards del kanban.
 * Para revertir a la paleta anterior, editá los valores acá sin tocar la lógica.
 */

import type { ProjectType } from "@/lib/projects/types";

// ── Chips de tipo ──────────────────────────────────────────────────────────────
// Sólido con color propio por tipo.
// Para revertir: importar PROJECT_TYPE_CLASS de @/lib/projects/types en projects-kanban.tsx
// y reemplazar CARD_TYPE_CHIP por ese record.
export const CARD_TYPE_CHIP: Record<ProjectType, string> = {
  pack: "bg-amber-500 text-white",
  long_form: "bg-blue-600 text-white",
  short_form: "bg-violet-600 text-white",
  other: "bg-stone-500 text-white",
};

// Iniciales para mostrar el tipo de proyecto en la card (más compacto)
export const CARD_TYPE_INITIAL: Record<ProjectType, string> = {
  pack: "P",
  long_form: "LF",
  short_form: "SF",
  other: "O",
};

// Base compartida de chips pequeños (tipo + cliente)
export const CARD_CHIP_BASE =
  "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider leading-none";

// Chip de tipo: padding reducido ya que solo muestra 2 chars (LF / SF)
export const CARD_TYPE_CHIP_BASE =
  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider leading-none";

export const CARD_CLIENT_CHIP_BASE =
  "inline-flex min-w-0 max-w-[150px] items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white leading-none overflow-hidden";

// ── Badges de estado financiero (COBRADO / PAGADO / FACTURADO) ─────────────────
export function financialBadgeClass(pct: number): string {
  if (pct >= 100)
    return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30";
  if (pct > 0)
    return "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30";
  return "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30";
}

// Badge no-interactivo (FACTURADO — pendiente de implementación)
export function financialBadgeClassStatic(pct: number): string {
  if (pct >= 100) return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  if (pct > 0)    return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
  return "bg-red-500/20 text-red-400 border border-red-500/30";
}
