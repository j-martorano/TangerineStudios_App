"use client";

import { useEffect, useState, useTransition } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { changeProjectDuration } from "@/lib/projects/actions";

type Props = {
  id: string;
  value: number | null;
  /** Si está bloqueado (proyecto finalizado), muestra el valor como texto. */
  disabled?: boolean;
  /** Cuánto suma/resta cada botón. Default 1. */
  step?: number;
  size?: "default" | "compact";
};

/**
 * Editor en línea de la duración (en minutos) de un proyecto. Tiene botones
 * de + y −, e input numérico. Guarda en blur o al apretar los botones. Si
 * deja el input vacío y blurea, queda como null.
 */
export function QuickDurationEditor({
  id,
  value,
  disabled = false,
  step = 1,
  size = "default",
}: Props) {
  const [draft, setDraft] = useState<string>(
    value != null ? String(value) : ""
  );
  const [pending, startTransition] = useTransition();

  // Sincronizamos el draft cuando cambia el valor del server (después de
  // guardar, revalidar, etc.). React no resetea state en cada re-render.
  useEffect(() => {
    setDraft(value != null ? String(value) : "");
  }, [value]);

  function save(next: number | null) {
    setDraft(next != null ? String(next) : "");
    startTransition(async () => {
      const result = await changeProjectDuration(id, next);
      if (!result.ok) {
        toast.error(result.error);
        setDraft(value != null ? String(value) : "");
      }
    });
  }

  function adjust(delta: number) {
    const current = draft === "" ? 0 : Number(draft);
    if (Number.isNaN(current)) return;
    const next = Math.max(0, Number((current + delta).toFixed(2)));
    save(next);
  }

  function handleBlur() {
    if (draft === "") {
      if (value !== null) save(null);
      return;
    }
    const n = Number(draft);
    if (Number.isNaN(n) || n < 0) {
      setDraft(value != null ? String(value) : "");
      return;
    }
    if (n !== value) save(n);
  }

  if (disabled) {
    return (
      <span className="tabular-nums text-muted-foreground">
        {value != null ? `${value} min` : "—"}
      </span>
    );
  }

  const compact = size === "compact";
  const btnClass = `inline-flex shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 ${
    compact ? "size-5" : "size-6"
  }`;
  const inputClass = `text-center tabular-nums bg-transparent focus:outline-none focus:ring-1 focus:ring-primary rounded ${
    compact
      ? "h-5 w-10 text-xs border-0"
      : "h-7 w-14 text-xs border border-border/60"
  }`;

  return (
    <div
      className="inline-flex items-center gap-0.5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => adjust(-step)}
        disabled={pending}
        aria-label={`Restar ${step} minuto${step === 1 ? "" : "s"}`}
        className={btnClass}
      >
        <MinusIcon className={compact ? "size-3" : "size-3.5"} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        disabled={pending}
        className={inputClass}
        aria-label="Duración en minutos"
      />
      <button
        type="button"
        onClick={() => adjust(step)}
        disabled={pending}
        aria-label={`Sumar ${step} minuto${step === 1 ? "" : "s"}`}
        className={btnClass}
      >
        <PlusIcon className={compact ? "size-3" : "size-3.5"} />
      </button>
    </div>
  );
}
