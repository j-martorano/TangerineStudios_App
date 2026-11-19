"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, Trash2Icon } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { deleteOutreachMessage, updateOutreachMessage } from "@/lib/outreach/actions";
import {
  OUTREACH_STATUSES,
  STATUS_LABEL,
  type OutreachMessage,
  type OutreachPlatform,
  type OutreachStatus,
} from "@/lib/outreach/types";

import { PlatformIcon } from "./platform-icon";
import { StatusBadge } from "./status-badge";

const NONE = "__none";

type Props = {
  message: OutreachMessage | null;
  platforms: OutreachPlatform[];
  open: boolean;
  onClose: () => void;
};

/** Ver, editar o borrar un mensaje del registro. */
export function MessageDialog({ message, platforms, open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {open && message ? (
          <FormBody key={message.id} message={message} platforms={platforms} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormBody({
  message,
  platforms,
  onClose,
}: {
  message: OutreachMessage;
  platforms: OutreachPlatform[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [clientName, setClientName] = useState(message.clientName);
  const [platformId, setPlatformId] = useState<string>(message.platformId ?? NONE);
  const [status, setStatus] = useState<OutreachStatus>(message.status);
  const [sentAt, setSentAt] = useState(message.sentAt);
  const [postUrl, setPostUrl] = useState(message.postUrl ?? "");
  const [notes, setNotes] = useState(message.notes ?? "");
  const [text, setText] = useState(message.message);

  // Si la plataforma original se borró, se sigue mostrando su nombre.
  const orphanName = message.platformId == null || !platforms.some((p) => p.id === message.platformId)
    ? message.platformName
    : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateOutreachMessage(message.id, {
        clientName,
        platformId: platformId === NONE ? null : platformId,
        message: text,
        postUrl,
        status,
        notes,
        resources: message.resources,
        sentAt,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Mensaje actualizado");
      onClose();
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteOutreachMessage(message.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Mensaje borrado");
      setConfirmDelete(false);
      onClose();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Mensaje a {message.clientName}</DialogTitle>
        <DialogDescription>
          Enviado el {message.sentAt.split("-").reverse().join("/")}
          {message.platformName ? ` por ${message.platformName}` : ""}.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="msg-client">Nombre cliente</Label>
          <Input id="msg-client" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Plataforma</Label>
          <Select value={platformId} onValueChange={(v) => v && setPlatformId(v)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string | null) => {
                  const p = platforms.find((x) => x.id === v);
                  if (p) {
                    return (
                      <>
                        <PlatformIcon icon={p.icon} className="size-4" style={{ color: p.color }} />
                        {p.name}
                      </>
                    );
                  }
                  return orphanName || "Sin plataforma";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{orphanName || "Sin plataforma"}</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <PlatformIcon icon={p.icon} className="size-4" style={{ color: p.color }} />
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Estado</Label>
          <Select value={status} onValueChange={(v) => v && setStatus(v as OutreachStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string | null) => <StatusBadge status={(v as OutreachStatus) ?? status} />}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {OUTREACH_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <StatusBadge status={s} />
                  <span className="sr-only">{STATUS_LABEL[s]}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="msg-date">Fecha de envío</Label>
          <Input id="msg-date" type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="msg-post">Link del post</Label>
          <Input
            id="msg-post"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://…"
            autoComplete="off"
          />
        </div>
      </div>

      {message.resources.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label>Páginas y samples que fueron</Label>
          <div className="flex flex-wrap gap-1">
            {message.resources.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-full border px-2 py-0.5 text-[11px] hover:underline ${
                  r.kind === "sample"
                    ? "border-[#37ACFF]/40 text-[#37ACFF]"
                    : "border-[#FFAC37]/40 text-[#FFAC37]"
                }`}
              >
                {r.name}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="msg-text">Mensaje</Label>
          <Button type="button" variant="ghost" size="xs" onClick={copy}>
            <CopyIcon data-icon="inline-start" />
            Copiar
          </Button>
        </div>
        <Textarea
          id="msg-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="min-h-40 leading-relaxed"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="msg-notes">Notas</Label>
        <Textarea
          id="msg-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Qué respondió, próximos pasos…"
          className="min-h-16"
        />
      </div>

      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
          disabled={pending}
        >
          <Trash2Icon data-icon="inline-start" />
          Borrar
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogFooter>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar el mensaje a {message.clientName}</AlertDialogTitle>
            <AlertDialogDescription>
              Se saca del registro. No se puede deshacer.
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
    </form>
  );
}
