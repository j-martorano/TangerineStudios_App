"use client";

import { toast } from "sonner";

import { FIXED_TAGS } from "@/lib/outreach/render";
import type { OutreachResource } from "@/lib/outreach/types";

/**
 * Lista de etiquetas que se pueden usar en una plantilla. Click = copiar la
 * etiqueta con llaves para pegarla en el texto, o insertarla directo si
 * quien la usa pasa `onPick` (el constructor de mensajes).
 */
export function TagsHelp({ resources, onPick }: { resources: OutreachResource[]; onPick?: (tag: string) => void }) {
  async function copy(tag: string) {
    if (onPick) {
      onPick(tag);
      return;
    }
    try {
      await navigator.clipboard.writeText(`{${tag}}`);
      toast.success(`{${tag}} copiado`);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  const items = [
    ...FIXED_TAGS,
    ...resources.map((r) => ({
      tag: r.tag,
      help: `Link de ${r.name}${r.kind === "sample" ? " (sample)" : " (página)"}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        {onPick
          ? "Click en una etiqueta para insertarla donde está el cursor. Se reemplazan solas al armar el mensaje."
          : "Las etiquetas se reemplazan solas al armar el mensaje. Click en una para copiarla."}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <button
            key={t.tag}
            type="button"
            onClick={() => copy(t.tag)}
            title={t.help}
            className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs text-foreground/80 transition-colors hover:border-[#FFAC37]/60 hover:text-foreground"
          >
            {`{${t.tag}}`}
          </button>
        ))}
      </div>
    </div>
  );
}
