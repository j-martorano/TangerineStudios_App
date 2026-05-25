import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectsKanban } from "@/components/projects/projects-kanban";
import { DataSearch } from "@/components/data-search";
import {
  fetchClients,
  fetchEditors,
  fetchProjects,
} from "@/lib/projects/queries";
import { isPack } from "@/lib/projects/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || undefined;

  const [allProjects, editors, clients] = await Promise.all([
    fetchProjects({ query }), // incluye finalizados â€” aparecen en la secciÃ³n Terminado
    fetchEditors(),
    fetchClients(),
  ]);

  // En el kanban no mostramos los packs como card propia â€” sus shorts hijos
  // sÃ­ aparecen, cada uno en su columna/secciÃ³n, con un chip que indica el pack.
  const projects = allProjects.filter((p) => !isPack(p));

  // Padres disponibles para asignar como pack en el form: proyectos top-level
  // (no hijos) no archivados.
  const availableParents = allProjects
    .filter((p) => !p.parent_id && !p.archived)
    .map((p) => ({ id: p.id, title: p.title, client_id: p.client_id }));

  return (
    <main className="flex w-full flex-col gap-6 p-4 md:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} proyecto{projects.length === 1 ? "" : "s"}
            {query ? <> Â· filtro: Â«{query}Â»</> : null}
          </p>
        </div>
        <NewProjectButton
          editors={editors}
          clients={clients}
          availableParents={availableParents}
        />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataSearch placeholder="Buscar por tÃ­tulo o clienteâ€¦" />
      </div>

      <ProjectsKanban
        projects={projects}
        editors={editors}
        clients={clients}
        availableParents={availableParents}
      />
    </main>
  );
}
