"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { InvoiceForm } from "./invoice-form";
import type { ClientForInvoice } from "@/lib/invoices/types";
import type { ProjectWithRelations } from "@/lib/projects/types";

type Props = {
  projects: ProjectWithRelations[];
  clients: ClientForInvoice[];
};

export function NewInvoiceButton({ projects, clients }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon className="size-4" />
        Nueva factura
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nueva factura</DialogTitle>
          <DialogDescription>
            Elegí el cliente, vinculá proyectos para auto-rellenar los ítems, y
            ajustá lo que necesites.
          </DialogDescription>
        </DialogHeader>
        <InvoiceForm
          projects={projects}
          clients={clients}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
