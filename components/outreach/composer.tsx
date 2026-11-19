"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardCheckIcon,
  CopyIcon,
  PlusIcon,
  RotateCcwIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayAR } from "@/lib/argentina-date";
import { createOutreachMessage } from "@/lib/outreach/actions";
import { renderMessage, templateFor } from "@/lib/outreach/render";
import {
  KIND_LABEL_PLURAL,
  type OutreachConfig,
  type OutreachResource,
  type ResourceKind,
} from "@/lib/outreach/types";

import { PlatformIcon } from "./platform-icon";

/**
 * Constructor de mensajes. El texto sale de la plantilla (de la plataforma o
 * la default) con las etiquetas reemplazadas por el nombre, las páginas y los
 * samples elegidos. Se puede retocar a mano antes de copiar; «Registrar y
 * copiar» guarda el mensaje tal cual quedó en el registro de abajo.
 */

type Slots = Record<ResourceKind, (string | null)[]>;

export function OutreachComposer({ config }: { config: OutreachConfig }) {
  const { platforms, resources, defaultTemplate } = config;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [clientName, setClientName] = useState("");
  const [platformId, setPlatformId] = useState<string | null>(platforms[0]?.id ?? null);
  const [slots, setSlots] = useState<Slots>({ pagina: [], sample: [] });
  const [postUrl, setPostUrl] = useState("");
  const [sentAt, setSentAt] = useState(todayAR());
  /** Texto editado a mano; null = se regenera solo desde la plantilla. */
  const [manual, setManual] = useState<string | null>(null);

  const platform = platforms.find((p) => p.id === platformId) ?? null;
  const byId = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  const selected: OutreachResource[] = useMemo(
    () =>
      [...slots.pagina, ...slots.sample]
        .map((id) => (id ? byId.get(id) : undefined))
        .filter((r): r is OutreachResource => r != null),
    [slots, byId]
  );

  const rendered = useMemo(
    () =>
      renderMessage(templateFor(platform, defaultTemplate), {
        clientName: clientName.trim(),
        platformName: platform?.name ?? "",
        selected,
        all: resources,
      }),
    [platform, defaultTemplate, clientName, selected, resources]
  );
  const text = manual ?? rendered;

  function addSlot(kind: ResourceKind) {
    setSlots((s) => ({ ...s, [kind]: [...s[kind], null] }));
  }
  function setSlot(kind: ResourceKind, index: number, id: string | null) {
    setSlots((s) => ({ ...s, [kind]: s[kind].map((v, i) => (i === index ? id : v)) }));
  }
  function removeSlot(kind: ResourceKind, index: number) {
    setSlots((s) => ({ ...s, [kind]: s[kind].filter((_, i) => i !== index) }));
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
        resources: selected.map((r) => ({ kind: r.kind, name: r.name, url: r.url })),
        sentAt,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(copied ? "Registrado y copiado" : "Registrado (no se pudo copiar)");
      setClientName("");
      setPostUrl("");
      setManual(null);
      setSentAt(todayAR());
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
            <Select value={platformId} onValueChange={(v) => v && setPlatformId(v)}>
              <SelectTrigger className="min-w-44">
                <SelectValue>
                  {(v: string | null) => {
                    const p = platforms.find((x) => x.id === v);
                    return p ? (
                      <>
                        <PlatformIcon icon={p.icon} className="size-4" style={{ color: p.color }} />
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
                    <PlatformIcon icon={p.icon} className="size-4" style={{ color: p.color }} />
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Link
              href="/outreach/configuracion"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Sin plataformas: creá una en Configurar
            </Link>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          render={<Link href="/outreach/configuracion" />}
        >
          <SettingsIcon data-icon="inline-start" />
          Configurar
        </Button>
      </div>

      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setManual(e.target.value)}
          spellCheck={false}
          className="min-h-56 bg-card/60 px-4 py-3 text-base leading-relaxed md:text-base"
          placeholder="Sin plantilla: escribí el mensaje o configurá una en Configurar."
        />
        {manual != null ? (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Editado a mano: no se regenera al cambiar las opciones.</span>
            <button
              type="button"
              onClick={() => setManual(null)}
              className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
            >
              <RotateCcwIcon className="size-3" />
              Volver a la plantilla
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto] md:items-start">
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

        <div className="flex w-full flex-col gap-2 md:w-72">
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
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {slots.map((id, i) => {
        // Un recurso elegido en otro slot no se vuelve a ofrecer.
        const taken = new Set(slots.filter((v, j) => v && j !== i));
        return (
          <div key={i} className="flex items-center gap-1.5">
            <Select value={id} onValueChange={(v) => onSet(i, v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) => options.find((o) => o.id === v)?.name ?? "Elegir…"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {options
                  .filter((o) => !taken.has(o.id))
                  .map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onRemove(i)}
              aria-label="Quitar"
            >
              <XIcon />
            </Button>
          </div>
        );
      })}
      {options.length === 0 ? (
        <Link
          href="/outreach/configuracion"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
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
