import { createClient } from "@/lib/supabase/server";
import { ProjectsKanban } from "@/components/projects/projects-kanban";
import { ProjectsTable } from "@/components/projects/projects-table";
import type { ProjectWithEditor } from "@/lib/projects/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, title, client_name, status, price, created_at, updated_at, editor_id, editor:editors ( id, name )"
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tangerine Studios
        </h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">No pude traer los proyectos.</p>
          <p className="font-mono text-xs">{error.message}</p>
        </div>
      </main>
    );
  }

  const projects = (data ?? []) as unknown as ProjectWithEditor[];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tangerine Studios
        </h1>
        <p className="text-sm text-muted-foreground">
          {projects.length} proyecto{projects.length === 1 ? "" : "s"}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Kanban
        </h2>
        <ProjectsKanban projects={projects} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Tabla
        </h2>
        <div className="rounded-xl border bg-card p-2">
          <ProjectsTable projects={projects} />
        </div>
      </section>
    </main>
  );
}
