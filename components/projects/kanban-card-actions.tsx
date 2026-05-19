"use client";

import { useState, useTransition } from "react";
import {
  ArchiveIcon,
  CheckCircle2Icon,
  MoreVerticalIcon,
  PencilIcon,
} from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ProjectForm } from "./project-form";
import {
  setProjectArchived,
  setProjectFinalized,
} from "@/lib/projects/actions";
import type {
  ClientForProject,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";

type Props = {
  project: ProjectWithRelations;
  editors: EditorMini[];
  clients: ClientForProject[];
};

export function KanbanCardActions({ project, editors, clients }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(async () => {
      const result = await setProjectArchived(project.id, true);
      if (result.ok) {
        toast.success(`«${project.title}» archivado`);
        setArchiveOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleFinalize() {
    startTransition(async () => {
      const result = await setProjectFinalized(project.id, true);
      if (result.ok) {
        toast.success(`«${project.title}» finalizado`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Acciones del proyecto"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          }
        >
          <MoreVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setEditOpen(true)}
            className="cursor-pointer"
          >
            <PencilIcon className="size-4" />
            <span>Editar</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleFinalize}
            disabled={pending}
            className="cursor-pointer text-emerald-500 focus:bg-emerald-500/15 focus:text-emerald-500"
          >
            <CheckCircle2Icon className="size-4" />
            <span>Finalizar</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setArchiveOpen(true)}
            className="cursor-pointer"
          >
            <ArchiveIcon className="size-4" />
            <span>Archivar</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar proyecto</DialogTitle>
          </DialogHeader>
          <ProjectForm
            mode="edit"
            project={project}
            editors={editors}
            clients={clients}
            onSuccess={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar «{project.title}»</AlertDialogTitle>
            <AlertDialogDescription>
              El proyecto sale de las vistas activas pero queda en el registro.
              Lo podés ver y desarchivar desde Proyectos con el filtro
              «Mostrar archivados».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={pending}>
              {pending ? "Archivando…" : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
