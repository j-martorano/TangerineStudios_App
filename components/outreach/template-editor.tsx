"use client";

import { useMemo } from "react";

import { templateSegments, type RenderedSegment } from "@/lib/outreach/render";
import { cn } from "@/lib/utils";

const TEXT_CLASS = "px-4 py-3 text-base leading-relaxed whitespace-pre-wrap break-words";

/**
 * Textarea con las etiquetas {ASI} pintadas. Truco clásico: un div con el
 * texto coloreado y, encima, un textarea con el texto transparente (solo se
 * ve el cursor y la selección). Los dos comparten celda de grid, así el div
 * le da la altura al textarea y no hay que sincronizar scroll.
 */
export function TemplateEditor({
  value,
  onChange,
  knownTags,
  placeholder,
  className,
  minHeightClass = "min-h-40",
}: {
  value: string;
  onChange: (v: string) => void;
  /** Etiquetas de recursos existentes (las fijas ya se conocen). */
  knownTags: string[];
  placeholder?: string;
  className?: string;
  minHeightClass?: string;
}) {
  const segments = useMemo(() => templateSegments(value, knownTags), [value, knownTags]);

  return (
    <div
      className={cn(
        "grid rounded-lg border border-input bg-card/60 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      <div aria-hidden className={cn(TEXT_CLASS, minHeightClass, "[grid-area:1/1] pointer-events-none")}>
        {value === "" && placeholder ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : null}
        {segments.map((s, i) =>
          s.kind === "text" ? (
            <span key={i}>{s.text}</span>
          ) : (
            // Sin padding ni margen: el ancho tiene que ser idéntico al del
            // textarea de arriba o el cursor se corre.
            <span
              key={i}
              className={cn(
                "rounded-sm",
                s.known ? "bg-[#FFAC37]/25 text-[#FFAC37]" : "bg-[#FF3737]/20 text-[#FF3737]"
              )}
              title={s.known ? undefined : "Etiqueta desconocida: no se va a reemplazar"}
            >
              {s.text}
            </span>
          )
        )}
        {/* Renglón extra: así el div mide lo mismo que el textarea cuando termina en salto de línea. */}
        {"\n"}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className={cn(
          TEXT_CLASS,
          "[grid-area:1/1] h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-foreground outline-none selection:bg-foreground/20"
        )}
      />
    </div>
  );
}

/** El mensaje final, con lo que vino de cada etiqueta resaltado. */
export function RenderedMessage({
  segments,
  className,
  minHeightClass = "min-h-40",
}: {
  segments: RenderedSegment[];
  className?: string;
  minHeightClass?: string;
}) {
  const empty = segments.every((s) => s.text === "");
  return (
    <div className={cn(TEXT_CLASS, minHeightClass, "rounded-lg border border-input bg-card/60", className)}>
      {empty ? <span className="text-muted-foreground">Sin mensaje.</span> : null}
      {segments.map((s, i) =>
        s.kind === "text" ? (
          <span key={i}>{s.text}</span>
        ) : s.kind === "value" ? (
          <span key={i} className="rounded-sm bg-[#37ACFF]/15 px-0.5 text-[#37ACFF]" title={`{${s.tag}}`}>
            {s.text}
          </span>
        ) : (
          <span key={i} className="rounded-sm bg-[#FF3737]/20 px-0.5 text-[#FF3737]" title="Etiqueta sin reemplazar">
            {s.text}
          </span>
        )
      )}
    </div>
  );
}
