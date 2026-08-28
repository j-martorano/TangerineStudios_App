"use client";

import { useTransition } from "react";
import { PowerIcon } from "lucide-react";
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
import { toggleEditorDisabled } from "@/lib/editors/actions";

type Props = {
  id: string;
  name: string;
  disabledAt: string | null;
};

export function ToggleDisabledButton({ id, name, disabledAt }: Props) {
  const [pending, startTransition] = useTransition();
  const isDisabled = disabledAt !== null;

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleEditorDisabled(id, !isDisabled);
      if (result.ok) {
        toast.success(
          isDisabled
            ? `Editor «${name}» habilitado nuevamente`
            : `Editor «${name}» deshabilitado`
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  if (isDisabled) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Habilitar editor"
        onClick={handleToggle}
        disabled={pending}
        className="text-green-500 hover:bg-green-500/20 hover:text-green-500"
        title="Habilitar editor"
      >
        <PowerIcon className="size-4" />
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Deshabilitar editor"
            className="text-amber-500 hover:bg-amber-500/20 hover:text-amber-500"
            title="Deshabilitar editor"
          />
        }
      >
        <PowerIcon className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deshabilitar «{name}»</AlertDialogTitle>
          <AlertDialogDescription>
            El editor ya no aparecerá en las listas de selección ni como
            editor por defecto de clientes. Sus proyectos existentes no
            se modifican. Podés volver a habilitarlo cuando quieras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleToggle} disabled={pending}>
            {pending ? "Deshabilitando…" : "Deshabilitar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
