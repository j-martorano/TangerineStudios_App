"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Visibilidad global de los montos. Por defecto están ocultos: se revelan
 * únicamente mientras se mantiene apretado el «ojito» (`AmountsToggle`).
 * Al soltar (o al salir del botón / perder foco) vuelven a ocultarse.
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

  // Si el usuario suelta el mouse/dedo fuera del botón (o la pestaña pierde
  // foco) igual ocultamos: nunca queremos que quede revelado "pegado".
  useEffect(() => {
    if (!revealed) return;
    const hide = () => setRevealed(false);
    window.addEventListener("pointerup", hide);
    window.addEventListener("pointercancel", hide);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointerup", hide);
      window.removeEventListener("pointercancel", hide);
      window.removeEventListener("blur", hide);
    };
  }, [revealed]);

  const value = useMemo(() => ({ revealed, setRevealed }), [revealed]);

  return (
    <AmountsContext.Provider value={value}>{children}</AmountsContext.Provider>
  );
}

/** `true` mientras el ojito esté apretado. */
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
      title="Mantené apretado el ojito para ver los montos"
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
 * El «ojito». Se mantiene apretado para revelar todos los montos de la app;
 * al soltar se vuelven a ocultar.
 */
export function AmountsToggle({ className }: { className?: string }) {
  const { revealed, setRevealed } = useContext(AmountsContext);
  const show = useCallback(() => setRevealed(true), [setRevealed]);
  const hide = useCallback(() => setRevealed(false), [setRevealed]);

  return (
    <button
      type="button"
      aria-pressed={revealed}
      aria-label="Mantené apretado para ver los montos"
      title="Mantené apretado para ver los montos"
      onPointerDown={show}
      onPointerUp={hide}
      onPointerLeave={hide}
      onPointerCancel={hide}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          show();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          hide();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "inline-flex size-8 shrink-0 cursor-pointer touch-none select-none items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
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
