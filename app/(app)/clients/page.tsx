import { ClientsTable } from "@/components/clients/clients-table";
import { NewClientButton } from "@/components/clients/new-client-button";
import { DataPagination } from "@/components/data-pagination";
import { DataSearch } from "@/components/data-search";
import { DEFAULT_PER_PAGE, fetchClientsList } from "@/lib/projects/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const { clients, total } = await fetchClientsList({ query, page });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {total} cliente{total === 1 ? "" : "s"}
          </p>
        </div>
        <NewClientButton />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataSearch placeholder="Buscar cliente por nombre…" />
      </div>

      <div className="rounded-xl border bg-card p-2">
        <ClientsTable clients={clients} />
      </div>

      <DataPagination
        page={page}
        perPage={DEFAULT_PER_PAGE}
        total={total}
        basePath="/clients"
        searchParams={{ q: query }}
      />
    </main>
  );
}
