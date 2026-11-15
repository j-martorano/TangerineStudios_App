import { fetchInvoices, fetchClientsForInvoice } from "@/lib/invoices/queries";
import { fetchProjects } from "@/lib/projects/queries";

import { InvoiceList } from "@/components/invoices/invoice-list";
import { NewInvoiceButton } from "@/components/invoices/new-invoice-button";
import { PendingInvoicesPanel } from "@/components/invoices/pending-invoices-panel";
import { AmountsToggle } from "@/components/ui/amount";


export default async function FacturasPage() {
  const [invoices, projects, clients] = await Promise.all([
    fetchInvoices(),
    fetchProjects(),
    fetchClientsForInvoice(),
  ]);

  const pendingProjects = projects
    .filter(
      (p) =>
        p.finalized &&
        p.finalized_at &&
        !p.parent_id &&
        !p.archived &&
        p.invoiced !== "si"
    )
    .sort(
      (a, b) =>
        new Date(b.finalized_at as string).getTime() -
        new Date(a.finalized_at as string).getTime()
    );

  return (
    <main className="flex w-full flex-col gap-6 p-4 md:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
          <AmountsToggle className="self-center" />
          <p className="text-sm text-muted-foreground">
            {invoices.length} factura{invoices.length === 1 ? "" : "s"}
          </p>
        </div>
        <NewInvoiceButton projects={projects} clients={clients} />
      </header>

      <PendingInvoicesPanel
        pendingProjects={pendingProjects}
        projects={projects}
        clients={clients}
      />

      <InvoiceList invoices={invoices} />
    </main>
  );
}
