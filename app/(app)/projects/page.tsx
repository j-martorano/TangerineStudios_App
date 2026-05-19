import Link from "next/link";

import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectsTable } from "@/components/projects/projects-table";
import { DataSearch } from "@/components/data-search";
import {
  fetchClients,
  fetchEditors,
  fetchProjects,
} from "@/lib/projects/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; year?: string; archived?: string }>;

function projectYear(iso: string | null | undefined): number {
  if (!iso) return 0;
  return new Date(iso).getUTCFullYear();
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || undefined;
  const showArchived = params.archived === "1";

  const [projects, editors, clients] = await Promise.all([
    fetchProjects({ query, includeArchived: showArchived }),
    fetchEditors(),
    fetchClients(),
  ]);

  // Años con proyectos, del más reciente al más viejo.
  const years = Array.from(
    new Set(projects.map((p) => projectYear(p.created_at)))
  ).sort((a, b) => b - a);

  const currentYear = new Date().getUTCFullYear();
  const requestedYear = Number(params.year);
  const selectedYear = years.includes(requestedYear)
    ? requestedYear
    : years.includes(currentYear)
      ? currentYear
      : (years[0] ?? currentYear);

  const yearProjects = projects.filter(
    (p) => projectYear(p.created_at) === selectedYear
  );

  function yearHref(year: number): string {
    const sp = new URLSearchParams();
    sp.set("year", String(year));
    if (query) sp.set("q", query);
    if (showArchived) sp.set("archived", "1");
    return `/projects?${sp.toString()}`;
  }

  function archivedToggleHref(): string {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (!showArchived) sp.set("archived", "1");
    const qs = sp.toString();
    return qs ? `/projects?${qs}` : "/projects";
  }

  const archivedCount = projects.filter((p) => p.archived).length;

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataSearch placeholder="Buscar por título o cliente…" />
        <Link
          href={archivedToggleHref()}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            showArchived
              ? "border-border bg-accent text-foreground"
              : "border-border text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          }`}
        >
          {showArchived
            ? "Ocultar archivados"
            : `Mostrar archivados${archivedCount > 0 ? ` (${archivedCount})` : ""}`}
        </Link>
      </div>

      {years.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 border-b">
          {years.map((year) => {
            const active = year === selectedYear;
            return (
              <Link
                key={year}
                href={yearHref(year)}
                className={`-mb-px rounded-t-lg border border-b-0 px-4 py-1.5 text-sm font-medium tabular-nums transition-colors ${
                  active
                    ? "border-border bg-card text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                {year === 0 ? "Sin fecha" : year}
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="rounded-xl border bg-card p-2">
        <ProjectsTable
          projects={yearProjects}
          editors={editors}
          clients={clients}
        />
      </div>
    </main>
  );
}
