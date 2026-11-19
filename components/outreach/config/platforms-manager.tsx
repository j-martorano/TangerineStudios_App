"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronsUpDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_COLORS } from "@/components/payment-methods/icon-map";
import { deletePlatform, savePlatform } from "@/lib/outreach/actions";
import type { OutreachPlatform } from "@/lib/outreach/types";

import { PLATFORM_ICONS, PlatformIcon } from "../platform-icon";

const DEFAULT_COLOR = "#888888";

export function PlatformsManager({ platforms }: { platforms: OutreachPlatform[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {platforms.map((p) => (
        <PlatformCard key={p.id} platform={p} />
      ))}
      {creating ? (
        <PlatformCard platform={null} onDone={() => setCreating(false)} />
      ) : (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setCreating(true)}>
          <PlusIcon data-icon="inline-start" />
          Nueva plataforma
        </Button>
      )}
    </div>
  );
}

function PlatformCard({
  platform,
  onDone,
}: {
  /** null = formulario de alta */
  platform: OutreachPlatform | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isNew = platform == null;

  const [name, setName] = useState(platform?.name ?? "");
  const [icon, setIcon] = useState<string | null>(platform?.icon ?? null);
  const [color, setColor] = useState(platform?.color ?? DEFAULT_COLOR);
  const [template, setTemplate] = useState(platform?.template ?? "");
  const [showTemplate, setShowTemplate] = useState(isNew || Boolean(platform?.template));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    isNew ||
    name !== platform.name ||
    icon !== platform.icon ||
    color !== platform.color ||
    template !== platform.template;

  function save() {
    startTransition(async () => {
      const res = await savePlatform({ id: platform?.id, name, icon, color, template });
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

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <IconPicker value={icon} color={color} onChange={setIcon} />
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label>Nombre</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Reddit, Instagram, Email…"
            autoFocus={isNew}
          />
        </div>
        <ColorPicker value={color} onChange={setColor} />
        {!isNew ? (
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
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setShowTemplate((v) => !v)}
          className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDownIcon className={`size-3.5 transition-transform ${showTemplate ? "" : "-rotate-90"}`} />
          Plantilla propia {template.trim() ? "" : "(usa la default)"}
        </button>
        {showTemplate ? (
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            spellCheck={false}
            className="min-h-32 leading-relaxed"
            placeholder="Vacío = esta plataforma usa la plantilla default."
          />
        ) : null}
      </div>

      {dirty ? (
        <div className="flex justify-end gap-2">
          {isNew ? (
            <Button variant="ghost" size="sm" onClick={onDone} disabled={pending}>
              Cancelar
            </Button>
          ) : null}
          <Button size="sm" onClick={save} disabled={pending || !name.trim()}>
            {pending ? "Guardando…" : isNew ? "Crear" : "Guardar"}
          </Button>
        </div>
      ) : null}

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

function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string | null;
  color: string;
  onChange: (key: string | null) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="h-8 gap-1.5" aria-label="Elegir ícono" />}
      >
        <PlatformIcon icon={value} className="size-4" style={{ color }} />
        <ChevronsUpDownIcon className="size-3 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Ícono
        </div>
        <div className="grid grid-cols-6 gap-1">
          {PLATFORM_ICONS.map(({ key, Icon, label }) => {
            const active = value === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
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
      </PopoverContent>
    </Popover>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="h-8 gap-1.5" aria-label="Elegir color" />}
      >
        <span className="size-4 rounded-full border border-white/20" style={{ backgroundColor: value }} />
        <ChevronsUpDownIcon className="size-3 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Color
        </div>
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
