import { EditorsTable } from "@/components/editors/editors-table";
import { NewEditorButton } from "@/components/editors/new-editor-button";
import { DataPagination } from "@/components/data-pagination";
import { DataSearch } from "@/components/data-search";
import { getAppUrl } from "@/lib/app-url";
import { getViewer } from "@/lib/auth/permissions";
import { fetchClients, fetchEditorsList } from "@/lib/projects/queries";
import { fetchPaymentMethods } from "@/lib/payment-methods/queries";
import { fetchUserPrefs } from "@/lib/settings/queries";
import { fetchAllCredentials } from "@/lib/vault/queries";


type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function EditorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const [prefs, viewer] = await Promise.all([fetchUserPrefs(), getViewer()]);
  const perPage = prefs.limits.editors_per_page;
  const isAdmin = viewer?.role === "admin";

  const [{ editors, total }, availableClients, paymentMethodsCatalog, credentials, appUrl] =
    await Promise.all([
      fetchEditorsList({ query, page, perPage }),
      fetchClients(),
      fetchPaymentMethods(),
      // Para «Crear usuario» desde la fila: solo un admin puede.
      isAdmin ? fetchAllCredentials() : Promise.resolve([]),
      getAppUrl(),
    ]);

  return (
    <main className="flex w-full flex-col gap-6 p-4 md:p-5">
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
          visibleColumns={prefs.columns.editors}
          isAdmin={isAdmin}
          credentials={credentials.map((c) => ({ id: c.id, name: c.name }))}
          appUrl={appUrl}
        />
      </div>

      <DataPagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/editors"
        searchParams={{ q: query }}
      />
    </main>
  );
}
