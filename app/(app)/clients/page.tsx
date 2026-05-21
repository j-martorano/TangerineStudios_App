import { ClientsTable } from "@/components/clients/clients-table";
import { NewClientButton } from "@/components/clients/new-client-button";
import { DataPagination } from "@/components/data-pagination";
import { DataSearch } from "@/components/data-search";
import { fetchClientsList, fetchEditors } from "@/lib/projects/queries";
import { fetchUserPrefs } from "@/lib/settings/queries";

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

  const prefs = await fetchUserPrefs();
  const perPage = prefs.limits.clients_per_page;

  const [{ clients, total }, availableEditors] = await Promise.all([
    fetchClientsList({ query, page, perPage }),
    fetchEditors(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {total} cliente{total === 1 ? "" : "s"}
          </p>
        </div>
        <NewClientButton availableEditors={availableEditors} />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataSearch placeholder="Buscar cliente por nombre…" />
      </div>

      <div className="rounded-xl border bg-card p-2">
        <ClientsTable
          clients={clients}
          availableEditors={availableEditors}
          visibleColumns={prefs.columns.clients}
        />
      </div>

      <DataPagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/clients"
        searchParams={{ q: query }}
      />
    </main>
  );
}
