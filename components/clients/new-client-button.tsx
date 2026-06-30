"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ClientForm } from "./client-form";
import type { EditorMini } from "@/lib/projects/types";

export function NewClientButton({
  availableEditors,
  availableParents,
  buttonClassName,
}: {
  availableEditors: EditorMini[];
  availableParents: { id: string; name: string }[];
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className={buttonClassName} />}>
        <PlusIcon className="size-4" />
        Nuevo cliente
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <ClientForm
          mode="create"
          availableEditors={availableEditors}
          availableParents={availableParents}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
