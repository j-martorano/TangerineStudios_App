"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { refreshAiModels, saveAiSettings } from "@/lib/outreach/actions";
import { DEFAULT_AI_MODEL, DEFAULT_AI_PROMPT, FALLBACK_AI_MODELS } from "@/lib/outreach/ai-prompt";
import type { GeminiModelInfo } from "@/lib/outreach/gemini";

/** Valor del Select para "usar el default del código" (el modelo guardado queda vacío). */
const MODEL_DEFAULT = "__default";

/**
 * Prompt y modelo del modo IA. El prompt viene cargado con el default y se
 * puede retocar; «Volver al default» lo deja como vino. El modelo se elige de
 * la lista que Google habilita para la key (viene del servidor, cacheada);
 * si no hay lista (sin key, Google caído) queda el campo de texto. Lo que la
 * IA recibe además del prompt (cliente, plataforma, mensaje base, páginas y
 * samples con su contexto) se explica al lado para que Joaco sepa qué no
 * hace falta escribir.
 */
export function AiSettings({
  prompt,
  model,
  models,
  configured,
}: {
  prompt: string | null;
  model: string | null;
  models: GeminiModelInfo[];
  configured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [text, setText] = useState(prompt ?? DEFAULT_AI_PROMPT);
  const [modelName, setModelName] = useState(model ?? "");

  const savedPrompt = prompt ?? DEFAULT_AI_PROMPT;
  const dirty = text !== savedPrompt || modelName !== (model ?? "");
  const isDefault = text.trim() === DEFAULT_AI_PROMPT.trim();
  const chain = [DEFAULT_AI_MODEL, ...FALLBACK_AI_MODELS];
  const listed = new Set(models.map((m) => m.id));

  function save() {
    startTransition(async () => {
      // Si quedó igual al default se guarda vacío, así un cambio futuro del default se aplica solo.
      const res = await saveAiSettings({ prompt: isDefault ? "" : text, model: modelName });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Configuración de IA guardada");
      router.refresh();
    });
  }

  function refreshList() {
    startRefresh(async () => {
      const res = await refreshAiModels();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Lista de modelos actualizada");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-prompt">Prompt</Label>
            {!isDefault ? (
              <button
                type="button"
                onClick={() => setText(DEFAULT_AI_PROMPT)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <RotateCcwIcon className="size-3" />
                Volver al default
              </button>
            ) : null}
          </div>
          <Textarea
            id="ai-prompt"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-64 leading-relaxed"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="ai-model">Modelo</Label>
              {configured ? (
                <button
                  type="button"
                  onClick={refreshList}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                >
                  <RefreshCwIcon className={refreshing ? "size-3 animate-spin" : "size-3"} />
                  {refreshing ? "Actualizando…" : "Actualizar lista"}
                </button>
              ) : null}
            </div>
            {models.length > 0 ? (
              <Select
                value={modelName || MODEL_DEFAULT}
                onValueChange={(v) => v && setModelName(v === MODEL_DEFAULT ? "" : v)}
              >
                <SelectTrigger id="ai-model" className="min-w-72" aria-label="Modelo">
                  <SelectValue>
                    {() =>
                      modelName ? (
                        <span className="font-mono text-xs">{modelName}</span>
                      ) : (
                        <span>
                          Por defecto{" "}
                          <span className="font-mono text-xs text-muted-foreground">({DEFAULT_AI_MODEL})</span>
                        </span>
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MODEL_DEFAULT}>
                    <span>Por defecto</span>
                    <span className="font-mono text-xs text-muted-foreground">{DEFAULT_AI_MODEL}</span>
                  </SelectItem>
                  {modelName && !listed.has(modelName) ? (
                    <SelectItem value={modelName}>
                      <span className="font-mono text-xs">{modelName}</span>
                      <span className="text-xs text-[#FFAC37]">ya no figura en Google</span>
                    </SelectItem>
                  ) : null}
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-mono text-xs">{m.id}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.label}
                        {chain.includes(m.id) ? " · de reserva" : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="ai-model"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder={DEFAULT_AI_MODEL}
                className="w-72 font-mono text-xs"
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </div>
          <Button onClick={save} disabled={pending || !dirty}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-3 text-sm text-muted-foreground">
        <p className={configured ? "text-[#37FF62]" : "text-[#FFAC37]"}>
          {configured
            ? "Gemini conectado (GEMINI_API_KEY está cargada)."
            : "Falta la API key: cargá GEMINI_API_KEY en las variables de Vercel. Se saca gratis en Google AI Studio."}
        </p>
        <p>
          Además del prompt, la IA recibe sola en cada pedido: el nombre del cliente, la plataforma, el mensaje
          base de esa plataforma como referencia de estilo, y la lista de páginas y samples con su{" "}
          <strong className="font-medium text-foreground">contexto</strong>. Con eso elige qué links mandar, así
          que el prompt es solo para el tono y las reglas.
        </p>
        <p>
          Cuanto mejor esté el contexto de cada página y sample (qué es, para qué rubro, qué estilo), mejor
          elige. Se carga en las secciones de abajo.
        </p>
        <p>
          El modelo por defecto es <code className="font-mono text-xs">{DEFAULT_AI_MODEL}</code>, que tiene cuota
          gratuita diaria. Si está saturado o Google lo retira, se prueba automáticamente con{" "}
          {FALLBACK_AI_MODELS.join(", ")}.
        </p>
        {models.length > 0 ? (
          <p>
            La lista de modelos es la que Google habilita hoy para la key; se renueva sola cada 6 horas o con
            «Actualizar lista». No todos tienen cuota gratuita: los «pro» suelen cortar enseguida con «se alcanzó el
            límite», y si uno falla se sigue con los de reserva.
          </p>
        ) : configured ? (
          <p>Google no devolvió la lista de modelos ahora; el nombre se puede escribir a mano igual.</p>
        ) : null}
      </div>
    </div>
  );
}
