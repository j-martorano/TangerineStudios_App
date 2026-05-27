import { fetchInvoices } from "@/lib/invoices/queries";
import { fetchProjects, fetchClients } from "@/lib/projects/queries";

import { InvoiceList } from "@/components/invoices/invoice-list";
import { NewInvoiceButton } from "@/components/invoices/new-invoice-button";

export const dynamic = "force-dynamic";

export default async function FacturasPage() {
  const [invoices, projects, clients] = await Promise.all([
    fetchInvoices(),
    fetchProjects(),
    fetchClients(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-5">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
          <p className="text-sm text-muted-foreground">
            {invoices.length === 0
              ? "No hay facturas generadas aún."
              : `${invoices.length} factura${invoices.length === 1 ? "" : "s"} en total.`}
          </p>
        </div>
        <NewInvoiceButton projects={projects} clients={clients} />
      </header>

      <InvoiceList invoices={invoices} />
    </main>
  );
}
