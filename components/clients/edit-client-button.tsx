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

import { ClientForm } from "./client-form";
import type { ClientRow, EditorMini } from "@/lib/projects/types";

export function EditClientButton({
  client,
  availableEditors,
  availableParents,
}: {
  client: ClientRow & { editors?: EditorMini[] };
  availableEditors: EditorMini[];
  availableParents: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Editar cliente" />
        }
      >
        <PencilIcon className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
        </DialogHeader>
        <ClientForm
          mode="edit"
          client={client}
          availableEditors={availableEditors}
          availableParents={availableParents}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
