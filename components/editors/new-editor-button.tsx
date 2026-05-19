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

import { EditorForm } from "./editor-form";
import type { ClientMini } from "@/lib/projects/types";
import type { PaymentMethod } from "@/lib/payment-methods/queries";

export function NewEditorButton({
  availableClients,
  paymentMethodsCatalog,
}: {
  availableClients: ClientMini[];
  paymentMethodsCatalog: PaymentMethod[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon className="size-4" />
        Nuevo editor
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo editor</DialogTitle>
        </DialogHeader>
        <EditorForm
          mode="create"
          availableClients={availableClients}
          paymentMethodsCatalog={paymentMethodsCatalog}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
