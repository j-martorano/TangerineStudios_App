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
import type { ClientForProject, ProjectWithRelations } from "@/lib/projects/types";

type Props = {
  projects: ProjectWithRelations[];
  clients: ClientForProject[];
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva factura</DialogTitle>
          <DialogDescription>
            Completá los datos. Podés vincular proyectos para auto-rellenar
            los ítems.
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
