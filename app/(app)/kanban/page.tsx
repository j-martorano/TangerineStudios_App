import { NewProjectButton, NewHistoricProjectButton, NewClientPaymentButton } from "@/components/projects/new-project-button";
import { ProjectsKanban } from "@/components/projects/projects-kanban";
import { DataSearch } from "@/components/data-search";
import {
  fetchClients,
  fetchEditors,
  fetchProjects,
} from "@/lib/projects/queries";
import { fetchClientsForInvoice } from "@/lib/invoices/queries";
import { fetchRetainerPayments } from "@/lib/finanzas/queries";
import { isPack } from "@/lib/projects/types";


type SearchParams = Promise<{ q?: string; focus?: string }>;

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || undefined;
  const focusId = params.focus?.trim() || undefined;

  const [allProjects, editors, clients, clientsForInvoice, retainerPayments] = await Promise.all([
    fetchProjects({ query }),
    fetchEditors(),
    fetchClients(),
    fetchClientsForInvoice(),
    fetchRetainerPayments(),
  ]);

  // En el kanban mostramos packs (con lista de hijos adentro del card).
  // Los proyectos hijos (parent_id != null) no aparecen como cards individuales.
  const projects = allProjects.filter((p) => !p.parent_id);

  // Padres disponibles: solo proyectos de tipo "pack" no archivados.
  const availableParents = allProjects
    .filter((p) => p.project_type === "pack" && !p.archived)
    .map((p) => ({ id: p.id, title: p.title, client_id: p.client_id }));

  return (
    <main className="flex w-full flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <NewProjectButton
              editors={editors}
              clients={clients}
              availableParents={availableParents}
            />
            <NewHistoricProjectButton
              editors={editors}
              clients={clients}
              availableParents={availableParents}
            />
            <NewClientPaymentButton clients={clients} />
          </div>
          <h1 className="mt-3 text-5xl font-bold uppercase tracking-tight">
            Kanban
          </h1>
          <p className="mt-1 text-sm font-light text-muted-foreground">
            {projects.length} proyecto{projects.length === 1 ? "" : "s"}
            {query ? <> · filtro: «{query}»</> : null}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataSearch placeholder="Buscar por título o cliente…" />
      </div>

      <ProjectsKanban
        projects={projects}
        editors={editors}
        clients={clients}
        clientsForInvoice={clientsForInvoice}
        availableParents={availableParents}
        highlightId={focusId}
        retainerPayments={retainerPayments}
      />
    </main>
  );
}
