import Link from "next/link";

import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectsTable } from "@/components/projects/projects-table";
import { DataSearch } from "@/components/data-search";
import {
  fetchClients,
  fetchEditors,
  fetchProjects,
} from "@/lib/projects/queries";
import { fetchUserPrefs } from "@/lib/settings/queries";

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

  const [projects, editors, clients, prefs] = await Promise.all([
    fetchProjects({ query, includeArchived: showArchived }),
    fetchEditors(),
    fetchClients(),
    fetchUserPrefs(),
  ]);

  const projectsPerYear = prefs.limits.projects_per_year;

  // Padres elegibles: solo proyectos de tipo "pack" no archivados.
  const availableParents = projects
    .filter((p) => p.project_type === "pack" && !p.archived)
    .map((p) => ({ id: p.id, title: p.title, client_id: p.client_id }));

  // Años con proyectos, del más reciente al más viejo. Sólo top-level (los
  // shorts hijos se cuentan dentro de su pack).
  const years = Array.from(
    new Set(
      projects.filter((p) => !p.parent_id).map((p) => projectYear(p.created_at))
    )
  ).sort((a, b) => b - a);

  const currentYear = new Date().getUTCFullYear();
  const requestedYear = Number(params.year);
  const selectedYear = years.includes(requestedYear)
    ? requestedYear
    : years.includes(currentYear)
      ? currentYear
      : (years[0] ?? currentYear);

  // Sólo top-level para el listado del año (los hijos se ven dentro del pack).
  const yearProjectsAll = projects.filter(
    (p) => !p.parent_id && projectYear(p.created_at) === selectedYear
  );
  const yearProjects = yearProjectsAll.slice(0, projectsPerYear);
  const yearTrimmed = yearProjectsAll.length - yearProjects.length;

  // Adjuntar los hijos (children ya vienen vinculados desde fetchProjects)
  // pero como filtramos por año/limit, los hijos siguen en su pack porque
  // las referencias son por objeto.

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
    <main className="flex w-full flex-col gap-6 p-4 md:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} proyecto{projects.length === 1 ? "" : "s"}
          </p>
        </div>
        <NewProjectButton
          editors={editors}
          clients={clients}
          availableParents={availableParents}
        />
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
          availableParents={availableParents}
          visibleColumns={prefs.columns.projects}
        />
      </div>

      {yearTrimmed > 0 ? (
        <p className="text-xs text-muted-foreground">
          Mostrando los primeros {projectsPerYear} proyectos del año. Hay{" "}
          {yearTrimmed} más sin mostrar — ajustá «Proyectos por año» en
          /configuración para verlos.
        </p>
      ) : null}
    </main>
  );
}
