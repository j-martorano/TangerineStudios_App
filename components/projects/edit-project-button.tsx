"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ProjectForm, type ParentOption } from "./project-form";
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
  variant?: "icon" | "ghost-icon";
  /** Si el proyecto está finalizado, la edición queda bloqueada. */
  disabled?: boolean;
};

export function EditProjectButton({
  project,
  editors,
  clients,
  availableParents = [],
  variant = "icon",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              disabled
                ? "Edición bloqueada — proyecto finalizado"
                : "Editar proyecto"
            }
            type="button"
            disabled={disabled}
            className={
              variant === "ghost-icon"
                ? "text-muted-foreground hover:text-foreground"
                : undefined
            }
          />
        }
      >
        <PencilIcon className="size-4" />
      </DialogTrigger>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
        </DialogHeader>
        <ProjectForm
          mode="edit"
          project={project}
          editors={editors}
          clients={clients}
          availableParents={availableParents}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
