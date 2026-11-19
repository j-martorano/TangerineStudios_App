"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_METHOD_COLORS } from "@/components/payment-methods/icon-map";
import { deletePlatform, savePlatform } from "@/lib/outreach/actions";
import type { OutreachPlatform, OutreachTemplate } from "@/lib/outreach/types";

import { IconField } from "../icon-field";
import { PLATFORM_ICONS, PlatformIcon } from "../platform-icon";

const DEFAULT_COLOR = "#888888";
const USE_DEFAULT = "__default";

export function PlatformsManager({
  platforms,
  templates,
  defaultTemplateId,
}: {
  platforms: OutreachPlatform[];
  templates: OutreachTemplate[];
  defaultTemplateId: string | null;
}) {
  const [creating, setCreating] = useState(false);
  const defaultName = templates.find((t) => t.id === defaultTemplateId)?.name ?? null;
  return (
    <div className="flex flex-col gap-3">
      <div className="hidden grid-cols-[auto_1fr_auto_minmax(14rem,1fr)_auto] gap-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 md:grid">
        <span className="w-16">Ícono</span>
        <span>Nombre</span>
        <span className="w-12">Color</span>
        <span>Mensaje</span>
        <span className="w-8" />
      </div>
      {platforms.map((p) => (
        <PlatformRow key={p.id} platform={p} templates={templates} defaultName={defaultName} />
      ))}
      {creating ? (
        <PlatformRow platform={null} templates={templates} defaultName={defaultName} onDone={() => setCreating(false)} />
      ) : (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setCreating(true)}>
          <PlusIcon data-icon="inline-start" />
          Nueva plataforma
        </Button>
      )}
    </div>
  );
}

function PlatformRow({
  platform,
  templates,
  defaultName,
  onDone,
}: {
  /** null = formulario de alta */
  platform: OutreachPlatform | null;
  templates: OutreachTemplate[];
  defaultName: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isNew = platform == null;

  const [name, setName] = useState(platform?.name ?? "");
  const [icon, setIcon] = useState<string | null>(platform?.icon ?? null);
  const [iconUrl, setIconUrl] = useState<string | null>(platform?.iconUrl ?? null);
  const [color, setColor] = useState(platform?.color ?? DEFAULT_COLOR);
  const [templateId, setTemplateId] = useState<string | null>(platform?.templateId ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    isNew ||
    name !== platform.name ||
    icon !== platform.icon ||
    iconUrl !== platform.iconUrl ||
    color !== platform.color ||
    templateId !== platform.templateId;

  function save() {
    startTransition(async () => {
      const res = await savePlatform({ id: platform?.id, name, icon, iconUrl, color, templateId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isNew ? "Plataforma creada" : "Plataforma guardada");
      onDone?.();
      router.refresh();
    });
  }

  function remove() {
    if (!platform) return;
    startTransition(async () => {
      const res = await deletePlatform(platform.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Plataforma borrada");
      setConfirmDelete(false);
      router.refresh();
    });
  }

  const templateLabel = (v: string | null) =>
    v && v !== USE_DEFAULT
      ? (templates.find((t) => t.id === v)?.name ?? "—")
      : `Default general${defaultName ? ` · ${defaultName}` : ""}`;

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-2 md:grid-cols-[auto_1fr_auto_minmax(14rem,1fr)_auto] md:items-center md:border-transparent md:bg-transparent md:p-1">
      <div className="w-16">
        <IconField
          value={iconUrl}
          onChange={setIconUrl}
          preview={<PlatformIcon icon={icon} iconUrl={iconUrl} className="size-4" style={{ color }} />}
        >
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Catálogo</div>
          <div className="grid grid-cols-6 gap-1">
            {PLATFORM_ICONS.map(({ key, Icon, label }) => {
              const active = !iconUrl && icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setIcon(key);
                    setIconUrl(null);
                  }}
                  title={label}
                  className={`flex size-8 items-center justify-center rounded-md border transition-colors ${
                    active ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent"
                  }`}
                >
                  <Icon className="size-4" style={{ color: active ? color : undefined }} />
                </button>
              );
            })}
          </div>
        </IconField>
      </div>
      <div className="flex flex-col gap-1 md:contents">
        <Label className="md:hidden">Nombre</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Reddit, Instagram, Email…"
          autoFocus={isNew}
          aria-label="Nombre"
        />
      </div>
      <div className="w-12">
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <Select
        value={templateId ?? USE_DEFAULT}
        onValueChange={(v) => setTemplateId(!v || v === USE_DEFAULT ? null : v)}
      >
        <SelectTrigger className="w-full" aria-label="Mensaje de la plataforma">
          <SelectValue>{(v: string | null) => templateLabel(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={USE_DEFAULT}>{templateLabel(null)}</SelectItem>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center justify-end gap-1">
        {dirty ? (
          <Button size="sm" onClick={save} disabled={pending || !name.trim()}>
            {pending ? "…" : isNew ? "Crear" : "Guardar"}
          </Button>
        ) : null}
        {isNew ? (
          <Button variant="ghost" size="sm" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            aria-label="Borrar plataforma"
            disabled={pending}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>

      {platform ? (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Borrar {platform.name}</AlertDialogTitle>
              <AlertDialogDescription>
                Los mensajes ya registrados conservan el nombre de la plataforma.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  remove();
                }}
                disabled={pending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/85"
              >
                Borrar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="h-8 gap-1 px-2" aria-label="Elegir color" />}
      >
        <span className="size-4 rounded-full border border-white/20" style={{ backgroundColor: value }} />
        <ChevronsUpDownIcon className="size-3 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Color</div>
        <div className="grid grid-cols-7 gap-1">
          {PAYMENT_METHOD_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              aria-label={hex}
              className={`size-6 rounded-full border-2 transition-transform hover:scale-110 ${
                value.toLowerCase() === hex.toLowerCase() ? "border-white" : "border-transparent"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 h-7 font-mono text-xs"
          placeholder="#FF4500"
        />
      </PopoverContent>
    </Popover>
  );
}
