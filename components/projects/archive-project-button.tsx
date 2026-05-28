"use client";

import { useState, useTransition } from "react";
import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
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

import { setProjectArchived, deleteProject } from "@/lib/projects/actions";

type Props = {
  id: string;
  title: string;
  archived: boolean;
};

export function ArchiveProjectButton({ id, title, archived }: Props) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function runArchive(next: boolean) {
    startTransition(async () => {
      const result = await setProjectArchived(id, next);
      if (result.ok) {
        toast.success(next ? `«${title}» archivado` : `«${title}» desarchivado`);
        setArchiveOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function runDelete() {
    startTransition(async () => {
      const result = await deleteProject(id);
      if (result.ok) {
        toast.success(`«${title}» eliminado permanentemente`);
        setDeleteOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  // Proyecto archivado: botón de restaurar + botón de eliminar
  if (archived) {
    return (
      <div className="flex items-center gap-0.5">
        {/* Restaurar */}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Desarchivar proyecto"
          disabled={pending}
          onClick={() => runArchive(false)}
        >
          <ArchiveRestoreIcon className="size-4" />
        </Button>

        {/* Eliminar permanentemente */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="Eliminar proyecto permanentemente"
                className="text-destructive/60 hover:text-destructive"
              />
            }
          >
            <Trash2Icon className="size-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar «{title}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción es <strong>permanente e irreversible</strong>. El
                proyecto y todos sus datos (cobros, pagos a editores, vínculos
                con facturas) se eliminarán definitivamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={runDelete}
                disabled={pending}
              >
                {pending ? "Eliminando…" : "Eliminar definitivamente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Proyecto activo: botón de archivar con confirmación
  return (
    <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
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
          <AlertDialogAction onClick={() => runArchive(true)} disabled={pending}>
            {pending ? "Archivando…" : "Archivar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
