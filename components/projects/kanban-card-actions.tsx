"use client";

import { useState, useTransition } from "react";
import {
  AlignJustifyIcon,
  ArchiveIcon,
  ClipboardCopyIcon,
  CopyIcon,
  PencilIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ProjectForm, type ParentOption } from "./project-form";
import { cloneProject, setProjectArchived } from "@/lib/projects/actions";
import type {
  ClientForProject,
  EditorMini,
  ProjectWithRelations,
} from "@/lib/projects/types";

type Props = {
  project: ProjectWithRelations;
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
  /** Llamado cuando el dropdown abre/cierra — usado para el efecto blur. */
  onMenuOpenChange?: (open: boolean) => void;
  /** Controlado externamente — permite que CardView maneje el diálogo de edición. */
  editOpen?: boolean;
  onEditOpenChange?: (v: boolean) => void;
  onCloneOpenChange?: (v: boolean) => void;
};

export function KanbanCardActions({
  project,
  editors,
  clients,
  availableParents = [],
  onMenuOpenChange,
  editOpen: editOpenProp,
  onEditOpenChange,
  onCloneOpenChange,
}: Props) {
  const [editOpenInternal, setEditOpenInternal] = useState(false);
  const editOpen = editOpenProp !== undefined ? editOpenProp : editOpenInternal;
  const setEditOpen = onEditOpenChange ?? setEditOpenInternal;
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneTitle, setCloneTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCopyCode() {
    navigator.clipboard
      .writeText(project.project_code)
      .then(() => toast.success(`Código «${project.project_code}» copiado`))
      .catch(() => toast.error("No se pudo copiar el código"));
  }

  function openCloneDialog() {
    setCloneTitle(project.title);
    setCloneOpen(true);
    onCloneOpenChange?.(true);
  }

  function handleClone() {
    startTransition(async () => {
      const result = await cloneProject(project.id, cloneTitle);
      if (result.ok) {
        toast.success(`Proyecto clonado`);
        setCloneOpen(false);
        onCloneOpenChange?.(false);
      } else {
        toast.error(result.error);
      }
    });
  }

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

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          onMenuOpenChange?.(open);
        }}
      >
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
          <AlignJustifyIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={handleCopyCode}
            className="cursor-pointer"
          >
            <ClipboardCopyIcon className="size-4" />
            <span>Copiar código</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setEditOpen(true)}
            className="cursor-pointer"
          >
            <PencilIcon className="size-4" />
            <span>Editar</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setArchiveOpen(true)}
            className="cursor-pointer"
          >
            <ArchiveIcon className="size-4" />
            <span>Archivar</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={openCloneDialog}
            className="cursor-pointer"
          >
            <CopyIcon className="size-4" />
            <span>Clonar</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent size="xl" className="z-[52]">
          <DialogHeader>
            <DialogTitle>Editar proyecto</DialogTitle>
          </DialogHeader>
          <ProjectForm
            mode="edit"
            project={project}
            editors={editors}
            clients={clients}
            availableParents={availableParents}
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

      {/* Dialog de clonar — pide el nombre del nuevo proyecto */}
      <Dialog
        open={cloneOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCloneOpen(false);
            onCloneOpenChange?.(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar proyecto</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              Se creará una copia exacta con todos los datos. El código se
              genera automáticamente.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="clone-title">Nombre del nuevo proyecto</Label>
              <Input
                id="clone-title"
                value={cloneTitle}
                onChange={(e) => setCloneTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !pending && cloneTitle.trim()) {
                    e.preventDefault();
                    handleClone();
                  }
                }}
                placeholder="Nombre del proyecto clonado"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setCloneOpen(false); onCloneOpenChange?.(false); }}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleClone}
              disabled={pending || !cloneTitle.trim()}
            >
              {pending ? "Clonando…" : "Clonar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
