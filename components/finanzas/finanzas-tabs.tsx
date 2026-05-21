"use client";

import { useState } from "react";

import {
  FINANZAS_TABS,
  FINANZAS_TAB_LABEL,
  type FinanzasTabId,
} from "@/lib/settings/types";

type Props = {
  /** IDs de pestañas visibles, en el orden en que se muestran. */
  visibleTabs: FinanzasTabId[];
  /** JSX por pestaña. */
  sections: Record<FinanzasTabId, React.ReactNode>;
};

/**
 * Navegador de pestañas para la página de Finanzas. Las pestañas visibles las
 * decide cada usuario desde /configuracion (sus preferencias). Si tiene todas
 * destildadas hacemos fallback a todas para no dejar la página vacía.
 */
export function FinanzasTabs({ visibleTabs, sections }: Props) {
  const tabs: FinanzasTabId[] =
    visibleTabs.length > 0
      ? visibleTabs
      : [...(FINANZAS_TABS as readonly FinanzasTabId[])];

  const [tab, setTab] = useState<FinanzasTabId>(tabs[0]);
  const active = tabs.includes(tab) ? tab : tabs[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-1 border-b">
        {tabs.map((t) => {
          const isActive = active === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px rounded-t-lg border border-b-0 px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-border bg-card text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              }`}
            >
              {FINANZAS_TAB_LABEL[t]}
            </button>
          );
        })}
      </div>
      <div>{sections[active]}</div>
    </div>
  );
}
