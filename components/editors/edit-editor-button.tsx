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

import { EditorForm } from "./editor-form";
import type { ClientMini, EditorRow } from "@/lib/projects/types";

export function EditEditorButton({
  editor,
  availableClients,
}: {
  editor: EditorRow & { clients?: ClientMini[] };
  availableClients: ClientMini[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Editar editor" />
        }
      >
        <PencilIcon className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar editor</DialogTitle>
        </DialogHeader>
        <EditorForm
          mode="edit"
          editor={editor}
          availableClients={availableClients}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
