import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectsTable } from "@/components/projects/projects-table";
import {
  fetchClients,
  fetchEditors,
  fetchProjects,
} from "@/lib/projects/queries";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, editors, clients] = await Promise.all([
    fetchProjects(),
    fetchEditors(),
    fetchClients(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} proyecto{projects.length === 1 ? "" : "s"}
          </p>
        </div>
        <NewProjectButton editors={editors} clients={clients} />
      </header>

      <div className="rounded-xl border bg-card p-2">
        <ProjectsTable projects={projects} />
      </div>
    </main>
  );
}
