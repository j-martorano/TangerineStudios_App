"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
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
import { deleteResource, saveResource } from "@/lib/outreach/actions";
import { tagFor } from "@/lib/outreach/render";
import { KIND_LABEL, type OutreachResource, type ResourceKind } from "@/lib/outreach/types";

import { IconField } from "../icon-field";
import { ResourceIcon } from "../platform-icon";

const GRID = "md:grid-cols-[auto_1fr_1.4fr_1fr_1.2fr_auto]";

/**
 * Páginas o samples (según `kind`): ícono, nombre, link, etiqueta y
 * descripción. La etiqueta se propone sola a partir del nombre mientras no
 * se toque; el ícono se detecta del link o se sube.
 */
export function ResourcesManager({
  kind,
  resources,
}: {
  kind: ResourceKind;
  resources: OutreachResource[];
}) {
  const [creating, setCreating] = useState(false);
  const items = resources.filter((r) => r.kind === kind);

  return (
    <div className="flex flex-col gap-2">
      <div className={`hidden gap-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 md:grid ${GRID}`}>
        <span className="w-16">Ícono</span>
        <span>Nombre</span>
        <span>Link</span>
        <span>Etiqueta</span>
        <span>Descripción</span>
        <span className="w-16" />
      </div>
      {items.length === 0 && !creating ? (
        <p className="px-1 text-sm text-muted-foreground">Todavía no hay {KIND_LABEL[kind].toLowerCase()}s.</p>
      ) : null}
      {items.map((r) => (
        <ResourceRow key={r.id} kind={kind} resource={r} />
      ))}
      {creating ? (
        <ResourceRow kind={kind} resource={null} onDone={() => setCreating(false)} />
      ) : (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setCreating(true)}>
          <PlusIcon data-icon="inline-start" />
          {kind === "sample" ? "Nuevo sample" : "Nueva página"}
        </Button>
      )}
    </div>
  );
}

function ResourceRow({
  kind,
  resource,
  onDone,
}: {
  kind: ResourceKind;
  resource: OutreachResource | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isNew = resource == null;

  const [name, setName] = useState(resource?.name ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [tag, setTag] = useState(resource?.tag ?? "");
  const [tagTouched, setTagTouched] = useState(!isNew);
  const [iconUrl, setIconUrl] = useState<string | null>(resource?.iconUrl ?? null);
  const [description, setDescription] = useState(resource?.description ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function changeName(v: string) {
    setName(v);
    if (!tagTouched) setTag(tagFor(kind, v));
  }

  const dirty =
    isNew ||
    name !== resource.name ||
    url !== resource.url ||
    tag !== resource.tag ||
    iconUrl !== resource.iconUrl ||
    description !== (resource.description ?? "");

  function save() {
    startTransition(async () => {
      const res = await saveResource({ id: resource?.id, kind, name, url, tag, iconUrl, description });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isNew ? `${KIND_LABEL[kind]} creado` : "Guardado");
      onDone?.();
      router.refresh();
    });
  }

  function remove() {
    if (!resource) return;
    startTransition(async () => {
      const res = await deleteResource(resource.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Borrado");
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div className={`grid gap-2 rounded-lg border border-border bg-card/40 p-2 md:items-center md:border-transparent md:bg-transparent md:p-1 ${GRID}`}>
      <div className="w-16">
        <IconField
          value={iconUrl}
          onChange={setIconUrl}
          detectUrl={url}
          preview={<ResourceIcon kind={kind} iconUrl={iconUrl} className="size-4" />}
        />
      </div>
      <Input
        value={name}
        onChange={(e) => changeName(e.target.value)}
        placeholder={kind === "sample" ? "Talking-head" : "Tangerine web"}
        aria-label="Nombre"
        autoFocus={isNew}
      />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        aria-label="Link"
        autoComplete="off"
      />
      <Input
        value={tag}
        onChange={(e) => {
          setTagTouched(true);
          setTag(e.target.value.toUpperCase());
        }}
        placeholder="SAMPLE_TALKING_HEAD"
        aria-label="Etiqueta"
        className="font-mono text-xs"
        spellCheck={false}
      />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Qué muestra (para elegir bien)"
        aria-label="Descripción"
      />
      <div className="flex w-16 items-center justify-end gap-1">
        {dirty ? (
          <Button size="icon-sm" onClick={save} disabled={pending || !name.trim() || !url.trim()} aria-label="Guardar">
            <CheckIcon />
          </Button>
        ) : null}
        {isNew ? (
          <Button variant="ghost" size="icon-sm" onClick={onDone} disabled={pending} aria-label="Cancelar">
            <XIcon />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={pending}
            aria-label="Borrar"
          >
            <Trash2Icon />
          </Button>
        )}
      </div>

      {resource ? (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Borrar {resource.name}</AlertDialogTitle>
              <AlertDialogDescription>
                Las plantillas que usen {`{${resource.tag}}`} van a mostrar la etiqueta sin reemplazar.
                Los mensajes ya registrados no cambian.
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
