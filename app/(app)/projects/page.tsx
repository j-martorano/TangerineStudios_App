import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectsTable } from "@/components/projects/projects-table";
import { DataPagination } from "@/components/data-pagination";
import { DataSearch } from "@/components/data-search";
import {
  DEFAULT_PER_PAGE,
  fetchClients,
  fetchEditors,
  fetchProjectsList,
} from "@/lib/projects/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const [{ projects, total }, editors, clients] = await Promise.all([
    fetchProjectsList({ query, page }),
    fetchEditors(),
    fetchClients(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            {total} proyecto{total === 1 ? "" : "s"}
          </p>
        </div>
        <NewProjectButton editors={editors} clients={clients} />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataSearch placeholder="Buscar por título o cliente…" />
      </div>

      <div className="rounded-xl border bg-card p-2">
        <ProjectsTable projects={projects} editors={editors} clients={clients} />
      </div>

      <DataPagination
        page={page}
        perPage={DEFAULT_PER_PAGE}
        total={total}
        basePath="/projects"
        searchParams={{ q: query }}
      />
    </main>
  );
}
