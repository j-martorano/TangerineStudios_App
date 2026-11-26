"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardCheckIcon,
  CopyIcon,
  PlusIcon,
  RotateCcwIcon,
  SettingsIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayAR } from "@/lib/argentina-date";
import { createOutreachMessage, generateOutreachMessage } from "@/lib/outreach/actions";
import { AI_LANGUAGES, type AiLanguage } from "@/lib/outreach/ai-prompt";
import { renderSegments, templateFor } from "@/lib/outreach/render";
import { KIND_LABEL_PLURAL, type OutreachConfig, type OutreachResource, type ResourceKind } from "@/lib/outreach/types";
import { cn } from "@/lib/utils";

import { TagsHelp } from "./config/tags-help";
import { PlatformIcon, ResourceIcon } from "./platform-icon";
import { RenderedMessage, TemplateEditor } from "./template-editor";

/**
 * Constructor de mensajes. Se edita la plantilla con las etiquetas a la vista
 * (vista «Plantilla»); «Resultado» muestra el mensaje con las etiquetas ya
 * reemplazadas por el nombre, las páginas y los samples elegidos. Copiar y
 * Registrar siempre usan el resultado, y dejan esa vista a la vista.
 *
 * El mensaje base se elige arriba: el de la plataforma (default), cualquiera
 * de la biblioteca, o «Vacío» para escribir desde cero. Debajo del editor
 * están los chips de etiquetas: click = insertar donde está el cursor.
 *
 * Modo IA: se pega el contexto del cliente (el posteo, quién es) y Gemini
 * escribe el mensaje con etiquetas y elige las páginas y samples. El
 * resultado cae en el mismo editor y los mismos slots, así se revisa, se
 * retoca y se registra igual que un mensaje a mano.
 */

type Slots = Record<ResourceKind, (string | null)[]>;
type View = "plantilla" | "resultado";

/** Qué mensaje base está cargado: el de la plataforma, uno puntual, o nada. */
const BASE_AUTO = "__auto";
const BASE_EMPTY = "__empty";

export function OutreachComposer({ config, aiConfigured }: { config: OutreachConfig; aiConfigured: boolean }) {
  const { platforms, resources, templates } = config;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [generating, startGenerating] = useTransition();
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const [clientName, setClientName] = useState("");
  const [platformId, setPlatformId] = useState<string | null>(platforms[0]?.id ?? null);
  const [baseId, setBaseId] = useState<string>(BASE_AUTO);
  const [slots, setSlots] = useState<Slots>({ pagina: [], sample: [] });
  const [postUrl, setPostUrl] = useState("");
  const [sentAt, setSentAt] = useState(todayAR());
  const [template, setTemplate] = useState(() => templateFor(platforms[0] ?? null, config));
  const [view, setView] = useState<View>("plantilla");
  const [aiMode, setAiMode] = useState(false);
  const [context, setContext] = useState("");
  const [language, setLanguage] = useState<AiLanguage>("auto");
  const [rationale, setRationale] = useState("");

  const platform = platforms.find((p) => p.id === platformId) ?? null;
  const byId = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const byTag = useMemo(() => new Map(resources.map((r) => [r.tag, r])), [resources]);
  const knownTags = useMemo(() => resources.map((r) => r.tag), [resources]);

  /** Cuerpo del mensaje base elegido; con eso se sabe si el editor fue retocado. */
  function baseBodyFor(base: string, platId: string | null): string {
    if (base === BASE_EMPTY) return "";
    if (base === BASE_AUTO) return templateFor(platforms.find((p) => p.id === platId) ?? null, config);
    return templates.find((t) => t.id === base)?.body ?? "";
  }
  const baseBody = baseBodyFor(baseId, platformId);
  const templateEdited = template !== baseBody;
  const baseLabel =
    baseId === BASE_EMPTY
      ? "Vacío"
      : baseId === BASE_AUTO
        ? `El de ${platform?.name ?? "la plataforma"}`
        : (templates.find((t) => t.id === baseId)?.name ?? "Mensaje");

  const selected: OutreachResource[] = useMemo(
    () =>
      [...slots.pagina, ...slots.sample]
        .map((id) => (id ? byId.get(id) : undefined))
        .filter((r): r is OutreachResource => r != null),
    [slots, byId]
  );

  const segments = useMemo(
    () =>
      renderSegments(template, {
        clientName: clientName.trim(),
        platformName: platform?.name ?? "",
        selected,
        all: resources,
      }),
    [template, clientName, platform, selected, resources]
  );
  const text = segments.map((s) => s.text).join("");

  function changePlatform(id: string) {
    setPlatformId(id);
    // Si el editor no fue tocado y sigue al de la plataforma, cambia con ella.
    if (baseId === BASE_AUTO && !templateEdited) setTemplate(baseBodyFor(BASE_AUTO, id));
  }
  function changeBase(id: string) {
    setBaseId(id);
    setTemplate(baseBodyFor(id, platformId));
  }
  function reloadTemplate() {
    setTemplate(baseBody);
  }

  function addSlot(kind: ResourceKind) {
    setSlots((s) => ({ ...s, [kind]: [...s[kind], null] }));
  }
  function setSlot(kind: ResourceKind, index: number, id: string | null) {
    setSlots((s) => ({ ...s, [kind]: s[kind].map((v, i) => (i === index ? id : v)) }));
  }
  function removeSlot(kind: ResourceKind, index: number) {
    setSlots((s) => ({ ...s, [kind]: s[kind].filter((_, i) => i !== index) }));
  }

  /** Inserta {TAG} donde está el cursor; si es una página o sample, también la marca como elegida. */
  function insertTag(tag: string) {
    const ins = `{${tag}}`;
    const el = editorRef.current;
    const start = el?.selectionStart ?? template.length;
    const end = el?.selectionEnd ?? start;
    setTemplate(template.slice(0, start) + ins + template.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + ins.length, start + ins.length);
    });
    const r = byTag.get(tag);
    if (r && !slots[r.kind].includes(r.id)) {
      setSlots((s) => ({ ...s, [r.kind]: [...s[r.kind], r.id] }));
    }
  }

  function generate() {
    if (!context.trim()) {
      toast.error("Pegá algo de contexto del cliente: el posteo, quién es, qué hace");
      return;
    }
    startGenerating(async () => {
      const res = await generateOutreachMessage({ clientName, platformId, context, language, baseTemplate: baseBody });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const chosen = res.data.resourceIds.map((id) => byId.get(id)).filter((r): r is OutreachResource => r != null);
      setTemplate(res.data.message);
      setSlots({
        pagina: chosen.filter((r) => r.kind === "pagina").map((r) => r.id),
        sample: chosen.filter((r) => r.kind === "sample").map((r) => r.id),
      });
      setRationale(res.data.rationale);
      setView("resultado");
      toast.success("Mensaje generado: revisalo antes de mandarlo");
    });
  }

  async function copyText(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      toast.error("No se pudo copiar al portapapeles");
      return false;
    }
  }

  async function handleCopy() {
    if (!text.trim()) {
      toast.error("El mensaje está vacío");
      return;
    }
    setView("resultado");
    if (await copyText()) toast.success("Mensaje copiado");
  }

  async function handleRegister() {
    if (!clientName.trim()) {
      toast.error("Poné el nombre del cliente para registrarlo");
      return;
    }
    if (!text.trim()) {
      toast.error("El mensaje está vacío");
      return;
    }
    setView("resultado");
    // Copiar primero: el portapapeles necesita el click del usuario.
    const copied = await copyText();
    startTransition(async () => {
      const res = await createOutreachMessage({
        clientName,
        platformId,
        message: text,
        postUrl,
        status: "enviado",
        notes: null,
        resources: selected.map((r) => ({ kind: r.kind, name: r.name, url: r.url, iconUrl: r.iconUrl })),
        sentAt,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(copied ? "Registrado y copiado" : "Registrado (no se pudo copiar)");
      setClientName("");
      setPostUrl("");
      setSentAt(todayAR());
      setContext("");
      setRationale("");
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-col gap-1.5">
          <Label htmlFor="outreach-client">Nombre cliente</Label>
          <Input
            id="outreach-client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Usuario, canal o persona"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Plataforma</Label>
          {platforms.length > 0 ? (
            <Select value={platformId} onValueChange={(v) => v && changePlatform(v)}>
              <SelectTrigger className="min-w-44">
                <SelectValue>
                  {(v: string | null) => {
                    const p = platforms.find((x) => x.id === v);
                    return p ? (
                      <>
                        <PlatformIcon icon={p.icon} iconUrl={p.iconUrl} className="size-4" style={{ color: p.color }} />
                        {p.name}
                      </>
                    ) : (
                      "Elegir…"
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <PlatformIcon icon={p.icon} iconUrl={p.iconUrl} className="size-4" style={{ color: p.color }} />
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Link href="/outreach/configuracion" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Sin plataformas: creá una en Configurar
            </Link>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Mensaje base</Label>
          <Select value={baseId} onValueChange={(v) => v && changeBase(v)}>
            <SelectTrigger className="min-w-44" aria-label="Mensaje base">
              <SelectValue>{() => baseLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BASE_AUTO}>El de la plataforma</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
              <SelectItem value={BASE_EMPTY}>Vacío (escribir desde cero)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-end gap-2">
          <Button
            variant={aiMode ? "default" : "outline"}
            size="sm"
            onClick={() => setAiMode((v) => !v)}
            aria-pressed={aiMode}
            className={cn(aiMode && "bg-[#37ACFF] text-black hover:bg-[#37ACFF]/85")}
          >
            <SparklesIcon data-icon="inline-start" />
            Modo IA
          </Button>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {(["plantilla", "resultado"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  view === v ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "plantilla" ? "Plantilla" : "Resultado"}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" render={<Link href="/outreach/configuracion" />}>
            <SettingsIcon data-icon="inline-start" />
            Configurar
          </Button>
        </div>
      </div>

      {aiMode ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[#37ACFF]/30 bg-[#37ACFF]/5 p-3">
          <Label htmlFor="outreach-context">Contexto del cliente</Label>
          <Textarea
            id="outreach-context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Pegá el posteo o contá quién es: qué hace, qué tipo de videos sube, qué necesita. Con eso la IA escribe el mensaje y elige qué páginas y samples mandarle."
            className="min-h-28 bg-background/60"
            disabled={generating}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={generate}
              disabled={generating || !aiConfigured}
              className="bg-[#37ACFF] font-semibold text-black hover:bg-[#37ACFF]/85"
            >
              <SparklesIcon data-icon="inline-start" />
              {generating ? "Generando…" : "Generar mensaje"}
            </Button>
            <div className="flex items-center gap-2">
              <Label htmlFor="outreach-language" className="text-xs text-muted-foreground">
                Idioma
              </Label>
              <Select value={language} onValueChange={(v) => v && setLanguage(v as AiLanguage)}>
                <SelectTrigger id="outreach-language" size="sm" className="min-w-40 bg-background/60" aria-label="Idioma del mensaje">
                  <SelectValue>{(v: string | null) => AI_LANGUAGES.find((l) => l.value === v)?.label ?? ""}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {AI_LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!aiConfigured ? (
              <span className="text-xs text-[#FFAC37]">
                Falta la API key de Gemini (GEMINI_API_KEY en Vercel).{" "}
                <Link href="/outreach/configuracion" className="underline underline-offset-4">
                  Ver en Configurar
                </Link>
              </span>
            ) : null}
          </div>
          {rationale ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Por qué eligió esto:</span> {rationale}
            </p>
          ) : null}
        </div>
      ) : null}

      {view === "plantilla" ? (
        <div className="flex flex-col gap-2">
          <TemplateEditor
            value={template}
            onChange={setTemplate}
            knownTags={knownTags}
            textareaRef={editorRef}
            minHeightClass="min-h-56"
            placeholder={
              baseId === BASE_EMPTY
                ? "Escribí el mensaje acá. Los chips de abajo insertan las etiquetas donde esté el cursor."
                : "Sin plantilla: escribí el mensaje acá o creá una en Configurar."
            }
          />
          {templateEdited ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Mensaje retocado para este envío.</span>
              <button
                type="button"
                onClick={reloadTemplate}
                className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
              >
                <RotateCcwIcon className="size-3" />
                Volver a «{baseLabel}»
              </button>
            </div>
          ) : null}
          <TagsHelp resources={resources} onPick={insertTag} />
        </div>
      ) : (
        <RenderedMessage segments={segments} minHeightClass="min-h-56" />
      )}

      <div className="flex flex-wrap items-start gap-6">
        {(["pagina", "sample"] as const).map((kind) => (
          <SlotColumn
            key={kind}
            kind={kind}
            slots={slots[kind]}
            options={resources.filter((r) => r.kind === kind)}
            onAdd={() => addSlot(kind)}
            onSet={(i, id) => setSlot(kind, i, id)}
            onRemove={(i) => removeSlot(kind, i)}
          />
        ))}

        <div className="ml-auto flex w-full flex-col gap-2 sm:w-80">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="Link del post (opcional)"
              autoComplete="off"
              aria-label="Link del post"
            />
            <Input
              type="date"
              value={sentAt}
              onChange={(e) => setSentAt(e.target.value)}
              aria-label="Fecha de envío"
              className="w-36"
            />
          </div>
          <Button variant="outline" onClick={handleCopy} disabled={pending}>
            <CopyIcon data-icon="inline-start" />
            Copiar
          </Button>
          <Button onClick={handleRegister} disabled={pending} className="font-semibold">
            <ClipboardCheckIcon data-icon="inline-start" />
            {pending ? "Registrando…" : "Registrar y copiar"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function SlotColumn({
  kind,
  slots,
  options,
  onAdd,
  onSet,
  onRemove,
}: {
  kind: ResourceKind;
  slots: (string | null)[];
  options: OutreachResource[];
  onAdd: () => void;
  onSet: (index: number, id: string | null) => void;
  onRemove: (index: number) => void;
}) {
  const label = kind === "sample" ? "#Samples" : KIND_LABEL_PLURAL[kind];
  return (
    <div className="flex w-full flex-col gap-2 sm:w-60">
      <Label>{label}</Label>
      {slots.map((id, i) => {
        // Un recurso elegido en otro slot no se vuelve a ofrecer.
        const taken = new Set(slots.filter((v, j) => v && j !== i));
        return (
          <div key={i} className="flex items-center gap-1">
            <Select value={id} onValueChange={(v) => onSet(i, v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) => {
                    const o = options.find((x) => x.id === v);
                    return o ? (
                      <>
                        <ResourceIcon kind={kind} iconUrl={o.iconUrl} className="size-4" />
                        {o.name}
                      </>
                    ) : (
                      "Elegir…"
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options
                  .filter((o) => !taken.has(o.id))
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <ResourceIcon kind={kind} iconUrl={o.iconUrl} className="size-4" />
                      {o.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon-sm" onClick={() => onRemove(i)} aria-label="Quitar">
              <XIcon />
            </Button>
          </div>
        );
      })}
      {options.length === 0 ? (
        <Link href="/outreach/configuracion" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          No hay {KIND_LABEL_PLURAL[kind].toLowerCase()} configurados
        </Link>
      ) : (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onAdd}
          disabled={slots.length >= options.length}
          aria-label={`Agregar ${KIND_LABEL_PLURAL[kind].toLowerCase()}`}
          className="self-start"
        >
          <PlusIcon />
        </Button>
      )}
    </div>
  );
}
