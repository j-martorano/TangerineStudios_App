"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { ChevronsUpDownIcon, ScanSearchIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { detectFavicon, uploadIcon } from "@/lib/outreach/actions";

/**
 * Elegir el ícono de una plataforma, página o sample: detectar el favicon de
 * un link, subir una imagen o quitarla. `preview` muestra el ícono actual;
 * `children` (opcional) va dentro del popover, antes de los botones (el
 * catálogo de íconos de las plataformas).
 */
export function IconField({
  value,
  onChange,
  detectUrl,
  preview,
  children,
  label = "Elegir ícono",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Link del que se puede detectar el favicon. */
  detectUrl?: string;
  preview: ReactNode;
  children?: ReactNode;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function detect() {
    if (!detectUrl?.trim()) {
      toast.error("Primero poné el link");
      return;
    }
    startTransition(async () => {
      const res = await detectFavicon(detectUrl);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onChange(res.data.url);
      setOpen(false);
    });
  }

  function upload(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadIcon(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onChange(res.data.url);
      setOpen(false);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="h-8 gap-1.5 px-2" aria-label={label} />}
      >
        {preview}
        <ChevronsUpDownIcon className="size-3 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {children}
        <div className={children ? "mt-2 flex flex-col gap-1 border-t border-border pt-2" : "flex flex-col gap-1"}>
          {detectUrl !== undefined ? (
            <Button type="button" variant="ghost" size="sm" className="justify-start" onClick={detect} disabled={pending}>
              <ScanSearchIcon data-icon="inline-start" />
              {pending ? "Buscando…" : "Detectar del link"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            <UploadIcon data-icon="inline-start" />
            Subir imagen
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              disabled={pending}
            >
              <Trash2Icon data-icon="inline-start" />
              Quitar imagen
            </Button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/avif,.ico"
          className="hidden"
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
