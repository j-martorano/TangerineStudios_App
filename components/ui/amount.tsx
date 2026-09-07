"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Visibilidad global de los montos. Por defecto están ocultos; el «ojito»
 * (`AmountsToggle`) los muestra y los vuelve a ocultar. Es un toggle, no un
 * mantener-apretado, así se puede scrollear con los montos a la vista.
 *
 * El estado vive en el layout de la app, así que se mantiene al navegar entre
 * páginas y se resetea a oculto al recargar.
 */
type AmountsContextValue = {
  revealed: boolean;
  setRevealed: (v: boolean) => void;
};

const AmountsContext = createContext<AmountsContextValue>({
  revealed: false,
  setRevealed: () => {},
});

export function AmountsProvider({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  const value = useMemo(() => ({ revealed, setRevealed }), [revealed]);

  return (
    <AmountsContext.Provider value={value}>{children}</AmountsContext.Provider>
  );
}

/** `true` cuando los montos están a la vista. */
export function useAmountsRevealed(): boolean {
  return useContext(AmountsContext).revealed;
}

/** Placeholder que reemplaza al monto cuando está oculto. */
export const AMOUNT_MASK = "•••••";

/**
 * Envuelve un monto ya formateado. Mientras los montos estén ocultos muestra
 * un placeholder de ancho fijo (no filtra la magnitud del número).
 *
 *   <Money>{formatPrice(total)}</Money>
 */
export function Money({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const revealed = useAmountsRevealed();
  if (revealed) return <>{children}</>;
  return (
    <span
      aria-label="Monto oculto"
      title="Tocá el ojito para ver los montos"
      className={cn(
        "select-none align-baseline tracking-[0.12em] text-muted-foreground/70",
        className
      )}
    >
      {AMOUNT_MASK}
    </span>
  );
}

/**
 * Devuelve el string a mostrar: el formateado si está revelado, el placeholder
 * si no. Útil donde no se puede meter un elemento (ej. `tickFormatter` de
 * recharts o props que esperan `string`).
 */
export function useMaskAmount(): (formatted: string) => string {
  const revealed = useAmountsRevealed();
  return useCallback(
    (formatted: string) => (revealed ? formatted : AMOUNT_MASK),
    [revealed]
  );
}

/**
 * El «ojito». Toggle: un click muestra todos los montos de la app y el
 * siguiente los vuelve a ocultar. Al ser toggle se puede scrollear, abrir
 * diálogos y navegar con los montos a la vista.
 */
export function AmountsToggle({ className }: { className?: string }) {
  const { revealed, setRevealed } = useContext(AmountsContext);
  const toggle = useCallback(
    () => setRevealed(!revealed),
    [revealed, setRevealed]
  );
  const label = revealed ? "Ocultar los montos" : "Mostrar los montos";

  return (
    <button
      type="button"
      aria-pressed={revealed}
      aria-label={label}
      title={label}
      onClick={toggle}
      className={cn(
        "inline-flex size-8 shrink-0 cursor-pointer select-none items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        revealed && "border-primary/50 bg-accent text-foreground",
        className
      )}
    >
      {revealed ? (
        <EyeIcon className="size-4" />
      ) : (
        <EyeOffIcon className="size-4" />
      )}
    </button>
  );
}
