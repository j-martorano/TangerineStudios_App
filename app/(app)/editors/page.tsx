import { EditorsTable } from "@/components/editors/editors-table";
import { NewEditorButton } from "@/components/editors/new-editor-button";
import { DataPagination } from "@/components/data-pagination";
import { DataSearch } from "@/components/data-search";
import {
  DEFAULT_PER_PAGE,
  fetchClients,
  fetchEditorsList,
} from "@/lib/projects/queries";
import { fetchPaymentMethods } from "@/lib/payment-methods/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function EditorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const [{ editors, total }, availableClients, paymentMethodsCatalog] =
    await Promise.all([
      fetchEditorsList({ query, page }),
      fetchClients(),
      fetchPaymentMethods(),
    ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Editores</h1>
          <p className="text-sm text-muted-foreground">
            {total} editor{total === 1 ? "" : "es"}
          </p>
        </div>
        <NewEditorButton
          availableClients={availableClients}
          paymentMethodsCatalog={paymentMethodsCatalog}
        />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataSearch placeholder="Buscar editor por nombre…" />
      </div>

      <div className="rounded-xl border bg-card p-2">
        <EditorsTable
          editors={editors}
          availableClients={availableClients}
          paymentMethodsCatalog={paymentMethodsCatalog}
        />
      </div>

      <DataPagination
        page={page}
        perPage={DEFAULT_PER_PAGE}
        total={total}
        basePath="/editors"
        searchParams={{ q: query }}
      />
    </main>
  );
}
