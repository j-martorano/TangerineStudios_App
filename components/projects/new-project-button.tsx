"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ProjectForm, type ParentOption } from "./project-form";
import type { ClientForProject, EditorMini } from "@/lib/projects/types";

export function NewProjectButton({
  editors,
  clients,
  availableParents = [],
}: {
  editors: EditorMini[];
  clients: ClientForProject[];
  availableParents?: ParentOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-2 border border-black/10 bg-white text-sm font-medium text-black shadow-sm transition-colors hover:bg-white/90 active:scale-[0.98]" style={{ borderRadius: "5px", padding: "5px 10px" }}
          />
        }
      >
        <PlusIcon className="size-4" />
        Nuevo Proyecto
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>
            Cargá los datos. Si el cliente no está en la lista, lo creás desde
            el combobox.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          mode="create"
          editors={editors}
          clients={clients}
          availableParents={availableParents}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
