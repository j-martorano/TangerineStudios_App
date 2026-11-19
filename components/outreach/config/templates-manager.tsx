"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
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
import { deleteTemplate, saveTemplate, setDefaultTemplate } from "@/lib/outreach/actions";
import type { OutreachPlatform, OutreachResource, OutreachTemplate } from "@/lib/outreach/types";
import { cn } from "@/lib/utils";

import { TemplateEditor } from "../template-editor";

/**
 * Biblioteca de mensajes base. Uno es el default general (estrella); cada
 * plataforma puede elegir otro desde su ficha.
 */
export function TemplatesManager({
  templates,
  defaultTemplateId,
  platforms,
  resources,
}: {
  templates: OutreachTemplate[];
  defaultTemplateId: string | null;
  platforms: OutreachPlatform[];
  resources: OutreachResource[];
}) {
  const [creating, setCreating] = useState(false);
  const knownTags = resources.map((r) => r.tag);
  return (
    <div className="flex flex-col gap-3">
      {templates.map((t) => (
        <TemplateCard
          key={t.id}
          template={t}
          isDefault={t.id === defaultTemplateId}
          usedBy={platforms.filter((p) => p.templateId === t.id).map((p) => p.name)}
          knownTags={knownTags}
        />
      ))}
      {creating ? (
        <TemplateCard template={null} isDefault={false} usedBy={[]} knownTags={knownTags} onDone={() => setCreating(false)} />
      ) : (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setCreating(true)}>
          <PlusIcon data-icon="inline-start" />
          Nuevo mensaje
        </Button>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  isDefault,
  usedBy,
  knownTags,
  onDone,
}: {
  /** null = formulario de alta */
  template: OutreachTemplate | null;
  isDefault: boolean;
  usedBy: string[];
  knownTags: string[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isNew = template == null;
  const [name, setName] = useState(template?.name ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = isNew || name !== template.name || body !== template.body;

  function save() {
    startTransition(async () => {
      const res = await saveTemplate({ id: template?.id, name, body });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isNew ? "Mensaje creado" : "Mensaje guardado");
      onDone?.();
      router.refresh();
    });
  }

  function makeDefault() {
    if (!template || isDefault) return;
    startTransition(async () => {
      const res = await setDefaultTemplate(template.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`«${template.name}» es ahora el mensaje default`);
      router.refresh();
    });
  }

  function remove() {
    if (!template) return;
    startTransition(async () => {
      const res = await deleteTemplate(template.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Mensaje borrado");
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {!isNew ? (
          <button
            type="button"
            onClick={makeDefault}
            disabled={pending || isDefault}
            title={isDefault ? "Es el mensaje default" : "Hacerlo el mensaje default"}
            aria-label={isDefault ? "Mensaje default" : "Hacer default"}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-lg border transition-colors",
              isDefault
                ? "border-[#FFAC37]/60 bg-[#FFAC37]/15 text-[#FFAC37]"
                : "border-border text-muted-foreground hover:text-[#FFAC37]"
            )}
          >
            <StarIcon className="size-4" fill={isDefault ? "currentColor" : "none"} />
          </button>
        ) : null}
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del mensaje (Default, Reddit casual, LinkedIn formal…)"
          className="min-w-64 flex-1 font-medium"
          autoFocus={isNew}
        />
        {isDefault ? (
          <span className="rounded-full bg-[#FFAC37]/15 px-2 py-0.5 text-[11px] font-medium text-[#FFAC37]">Default</span>
        ) : null}
        {usedBy.length > 0 ? (
          <span className="text-xs text-muted-foreground">Lo usa: {usedBy.join(", ")}</span>
        ) : null}
        {!isNew ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            aria-label="Borrar mensaje"
            disabled={pending}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </div>

      <TemplateEditor
        value={body}
        onChange={setBody}
        knownTags={knownTags}
        placeholder="Escribí el mensaje. Usá {PAGINAS} y {SAMPLES} donde quieras que vayan los links."
        minHeightClass="min-h-40"
      />

      {dirty ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isNew) onDone?.();
              else {
                setName(template.name);
                setBody(template.body);
              }
            }}
            disabled={pending}
          >
            {isNew ? "Cancelar" : "Descartar"}
          </Button>
          <Button size="sm" onClick={save} disabled={pending || !name.trim()}>
            {pending ? "Guardando…" : isNew ? "Crear" : "Guardar"}
          </Button>
        </div>
      ) : null}

      {template ? (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Borrar «{template.name}»</AlertDialogTitle>
              <AlertDialogDescription>
                {usedBy.length > 0
                  ? `${usedBy.join(", ")} pasan a usar el mensaje default. `
                  : ""}
                No se puede deshacer.
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
