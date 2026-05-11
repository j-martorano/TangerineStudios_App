"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ProjectForm } from "./project-form";
import type { ClientMini, EditorMini } from "@/lib/projects/types";

export function NewProjectButton({
  editors,
  clients,
}: {
  editors: EditorMini[];
  clients: ClientMini[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon className="size-4" />
        Nuevo proyecto
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
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
