import { ClientsTable } from "@/components/clients/clients-table";
import { NewClientButton } from "@/components/clients/new-client-button";
import { fetchClientsWithCount } from "@/lib/projects/queries";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await fetchClientsWithCount();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} cliente{clients.length === 1 ? "" : "s"}
          </p>
        </div>
        <NewClientButton />
      </header>

      <div className="rounded-xl border bg-card p-2">
        <ClientsTable clients={clients} />
      </div>
    </main>
  );
}
