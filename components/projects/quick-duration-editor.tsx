"use client";

import { useEffect, useState, useTransition } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { changeProjectDuration } from "@/lib/projects/actions";

function toMMSS(minutes: number): { mm: number; ss: number } {
  const total = Math.round(minutes * 60);
  return { mm: Math.floor(total / 60), ss: total % 60 };
}

function fromMMSS(mm: number, ss: number): number {
  return mm + ss / 60;
}

type Props = {
  id: string;
  value: number | null;
  /** Si está bloqueado (proyecto finalizado), muestra el valor como texto. */
  disabled?: boolean;
  /** Cuántos minutos suma/resta cada botón. Default 1. */
  step?: number;
  size?: "default" | "compact";
};

export function QuickDurationEditor({
  id,
  value,
  disabled = false,
  step = 1,
  size = "default",
}: Props) {
  const init = value != null ? toMMSS(value) : { mm: 0, ss: 0 };
  const [mm, setMm] = useState(value != null ? init.mm : NaN);
  const [ss, setSs] = useState(value != null ? init.ss : NaN);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (value != null) {
      const { mm: m, ss: s } = toMMSS(value);
      setMm(m);
      setSs(s);
    } else {
      setMm(NaN);
      setSs(NaN);
    }
  }, [value]);

  function save(nextMm: number, nextSs: number) {
    const next = isNaN(nextMm) && isNaN(nextSs) ? null : fromMMSS(nextMm || 0, nextSs || 0);
    startTransition(async () => {
      const result = await changeProjectDuration(id, next);
      if (!result.ok) {
        toast.error(result.error);
        if (value != null) {
          const { mm: m, ss: s } = toMMSS(value);
          setMm(m); setSs(s);
        } else {
          setMm(NaN); setSs(NaN);
        }
      }
    });
  }

  function adjust(delta: number) {
    const currentMm = isNaN(mm) ? 0 : mm;
    const currentSs = isNaN(ss) ? 0 : ss;
    const totalSecs = Math.max(0, currentMm * 60 + currentSs + delta * 60);
    const nextMm = Math.floor(totalSecs / 60);
    const nextSs = totalSecs % 60;
    setMm(nextMm);
    setSs(nextSs);
    save(nextMm, nextSs);
  }

  function handleBlurMm(e: React.FocusEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    const nextMm = isNaN(v) || v < 0 ? 0 : v;
    setMm(nextMm);
    save(nextMm, isNaN(ss) ? 0 : ss);
  }

  function handleBlurSs(e: React.FocusEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    const nextSs = isNaN(v) || v < 0 ? 0 : Math.min(v, 59);
    setSs(nextSs);
    save(isNaN(mm) ? 0 : mm, nextSs);
  }

  if (disabled) {
    if (value == null) return <span className="text-muted-foreground">—</span>;
    const { mm: m, ss: s } = toMMSS(value);
    return (
      <span className="tabular-nums text-muted-foreground">
        {m}:{s.toString().padStart(2, "0")}
      </span>
    );
  }

  const compact = size === "compact";
  const btnClass = `inline-flex shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 ${
    compact ? "size-5" : "size-6"
  }`;
  const noSpinner =
    "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
  const inputBase = `text-center tabular-nums bg-transparent focus:outline-none focus:ring-1 focus:ring-primary rounded ${noSpinner} ${
    compact ? "h-5 text-xs border-0" : "h-7 text-xs border border-border/60"
  }`;

  const mmVal = isNaN(mm) ? "" : String(mm);
  const ssVal = isNaN(ss) ? "" : ss.toString().padStart(2, "0");

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
        inputMode="numeric"
        min={0}
        value={mmVal}
        onChange={(e) => setMm(parseInt(e.target.value, 10))}
        onBlur={handleBlurMm}
        onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
        disabled={pending}
        placeholder="0"
        aria-label="Minutos"
        className={`${inputBase} ${compact ? "w-7" : "w-9"}`}
      />

      <span className="text-xs text-muted-foreground select-none">:</span>

      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={59}
        value={ssVal}
        onChange={(e) => setSs(parseInt(e.target.value, 10))}
        onBlur={handleBlurSs}
        onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
        disabled={pending}
        placeholder="00"
        aria-label="Segundos"
        className={`${inputBase} ${compact ? "w-7" : "w-9"}`}
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
