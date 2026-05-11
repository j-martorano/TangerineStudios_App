"use client";

import { useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
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

import { deleteClient } from "@/lib/clients/actions";

type Props = {
  id: string;
  name: string;
  projectCount: number;
};

export function DeleteClientButton({ id, name, projectCount }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteClient(id);
      if (result.ok) {
        toast.success(`Cliente «${name}» eliminado`);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar cliente"
            className="text-destructive hover:text-destructive"
          />
        }
      >
        <Trash2Icon className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar «{name}»</AlertDialogTitle>
          <AlertDialogDescription>
            {projectCount > 0 ? (
              <>
                Este cliente tiene <strong>{projectCount}</strong> proyecto
                {projectCount === 1 ? "" : "s"} asociado
                {projectCount === 1 ? "" : "s"}. Al eliminarlo, esos proyectos
                van a quedar <em>sin cliente</em> (no se borran). ¿Continuar?
              </>
            ) : (
              "Esta acción no se puede deshacer."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            render={
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={pending}
              />
            }
          >
            {pending ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
