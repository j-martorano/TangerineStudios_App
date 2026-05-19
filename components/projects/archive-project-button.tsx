"use client";

import { useState, useTransition } from "react";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { setProjectArchived } from "@/lib/projects/actions";

type Props = {
  id: string;
  title: string;
  archived: boolean;
};

/**
 * Reemplaza al borrado de proyectos: los proyectos nunca se borran, se
 * archivan (borrado lógico). Si el proyecto ya está archivado, el botón lo
 * desarchiva directamente.
 */
export function ArchiveProjectButton({ id, title, archived }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(next: boolean) {
    startTransition(async () => {
      const result = await setProjectArchived(id, next);
      if (result.ok) {
        toast.success(
          next ? `«${title}» archivado` : `«${title}» desarchivado`
        );
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (archived) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label="Desarchivar proyecto"
        disabled={pending}
        onClick={() => run(false)}
      >
        <ArchiveRestoreIcon className="size-4" />
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Archivar proyecto"
            type="button"
          />
        }
      >
        <ArchiveIcon className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archivar «{title}»</AlertDialogTitle>
          <AlertDialogDescription>
            El proyecto sale de las vistas activas pero queda en el registro.
            Lo podés volver a ver con el filtro «Mostrar archivados» y
            desarchivarlo cuando quieras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => run(true)} disabled={pending}>
            {pending ? "Archivando…" : "Archivar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
