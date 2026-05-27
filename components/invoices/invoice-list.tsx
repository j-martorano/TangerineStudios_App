"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { deleteInvoice, getInvoicePdfUrl } from "@/lib/invoices/actions";
import type { InvoiceWithProjects } from "@/lib/invoices/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(symbol: string, amount: number): string {
  return `${symbol}${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  invoices: InvoiceWithProjects[];
};

// ── Fila ─────────────────────────────────────────────────────────────────────

function InvoiceRow({ invoice }: { invoice: InvoiceWithProjects }) {
  const router = useRouter();
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();

  async function openPdf() {
    if (!invoice.pdf_storage_path) {
      toast.error("No hay PDF disponible para esta factura");
      return;
    }
    setLoadingPdf(true);
    const result = await getInvoicePdfUrl(invoice.pdf_storage_path);
    setLoadingPdf(false);
    if (result.ok) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(result.error);
    }
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteInvoice(invoice.id);
      if (result.ok) {
        setConfirmOpen(false);
        toast.success(`Factura ${invoice.invoice_code} eliminada`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <tr className="border-b border-border/40 transition-colors hover:bg-muted/30">
      {/* Código */}
      <td className="whitespace-nowrap px-4 py-3 text-sm font-mono font-medium">
        {invoice.invoice_code}
      </td>

      {/* Fecha */}
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {fmtDate(invoice.date)}
      </td>

      {/* Cliente */}
      <td className="max-w-[180px] truncate px-4 py-3 text-sm">
        {invoice.client_name}
      </td>

      {/* Total */}
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums">
        {fmt(invoice.currency_symbol, invoice.total)}
      </td>

      {/* Proyectos */}
      <td className="px-4 py-3">
        {invoice.projects.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {invoice.projects.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
              >
                {p.project_code ?? p.title}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </td>

      {/* Acciones */}
      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {/* PDF */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={openPdf}
            disabled={!invoice.pdf_storage_path || loadingPdf}
            title={invoice.pdf_storage_path ? "Ver PDF" : "Sin PDF"}
          >
            {loadingPdf ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : invoice.pdf_storage_path ? (
              <ExternalLinkIcon className="size-4" />
            ) : (
              <FileTextIcon className="size-4 text-muted-foreground/40" />
            )}
          </Button>

          {/* Eliminar */}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive/70 hover:text-destructive"
                  title="Eliminar factura"
                />
              }
            >
              <Trash2Icon className="size-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará permanentemente la factura{" "}
                  <strong>{invoice.invoice_code}</strong> de{" "}
                  <strong>{invoice.client_name}</strong>. Esta acción no se
                  puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletePending}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deletePending}
                >
                  {deletePending ? "Eliminando…" : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </tr>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function InvoiceList({ invoices }: Props) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-muted/20 py-16 text-center">
        <DownloadIcon className="size-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          No hay facturas todavía. Creá la primera con el botón de arriba.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                #
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Fecha
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cliente
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Proyectos
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
