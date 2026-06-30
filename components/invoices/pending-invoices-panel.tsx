"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReceiptIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoiceForm } from "./invoice-form";
import type { ClientForInvoice } from "@/lib/invoices/types";
import type { ProjectWithRelations } from "@/lib/projects/types";

export function PendingInvoicesPanel({
  pendingProjects,
  projects,
  clients,
}: {
  pendingProjects: ProjectWithRelations[];
  projects: ProjectWithRelations[];
  clients: ClientForInvoice[];
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (pendingProjects.length === 0) return null;

  function handleSelect(projectId: string, clientId: string | null) {
    setSelectedProjectId(projectId);
    setSelectedClientId(clientId);
    setOpen(true);
  }

  function handleClose(v: boolean) {
    setOpen(v);
    if (!v) {
      setSelectedProjectId(null);
      setSelectedClientId(null);
    }
  }

  function handleSuccess() {
    handleClose(false);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Facturas pendientes
        </h2>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
          {pendingProjects.length}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {pendingProjects.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 ring-1 ring-foreground/10"
          >
            {p.client && (
              <span
                className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                style={{ backgroundColor: p.client.color ?? "#666" }}
              >
                {p.client.name}
              </span>
            )}
            <span className="flex-1 truncate text-sm">{p.title}</span>
            {p.finalized_at && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(p.finalized_at).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            <button
              onClick={() => handleSelect(p.id, p.client_id)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-[#FFAC37] px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-[#FFAC37]/80"
            >
              <ReceiptIcon className="size-3" />
              Crear factura
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[min(50vw,680px)]">
          <DialogHeader>
            <DialogTitle>Nueva factura</DialogTitle>
            <DialogDescription>
              Proyecto preseleccionado. Revisá los ítems y generá la factura.
            </DialogDescription>
          </DialogHeader>
          {selectedProjectId && (
            <InvoiceForm
              key={selectedProjectId}
              projects={projects}
              clients={clients}
              initialProjectId={selectedProjectId}
              initialClientId={selectedClientId ?? undefined}
              onSuccess={handleSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
