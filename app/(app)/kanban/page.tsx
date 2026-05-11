import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectsKanban } from "@/components/projects/projects-kanban";
import { DataSearch } from "@/components/data-search";
import {
  fetchClients,
  fetchEditors,
  fetchProjects,
} from "@/lib/projects/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || undefined;

  const [projects, editors, clients] = await Promise.all([
    fetchProjects({ query }),
    fetchEditors(),
    fetchClients(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} proyecto{projects.length === 1 ? "" : "s"}
            {query ? <> · filtro: «{query}»</> : null}
          </p>
        </div>
        <NewProjectButton editors={editors} clients={clients} />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataSearch placeholder="Buscar por título o cliente…" />
      </div>

      <ProjectsKanban projects={projects} editors={editors} clients={clients} />
    </main>
  );
}
