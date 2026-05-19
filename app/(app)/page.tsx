import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchClients, fetchProjects } from "@/lib/projects/queries";
import { PROJECT_PHASES } from "@/lib/projects/types";
import type { ProjectPhase } from "@/lib/projects/types";
import {
  PHASE_CLASS,
  PHASE_LABEL,
  computeCost,
  computePrice,
  formatPrice,
} from "@/lib/projects/format";
import type { ProjectWithRelations } from "@/lib/projects/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projects, clients] = await Promise.all([
    fetchProjects(),
    fetchClients(),
  ]);

  const byPhase = countBy(projects, (p) => p.phase);
  const active = (byPhase.por_asignar ?? 0) + (byPhase.editando ?? 0);

  // Por cobrar: proyectos terminados que no están cobrados todavía
  const toCollectProjects = projects.filter(
    (p) => p.phase === "terminado" && p.cobrado !== "si"
  );
  // Por pagar: proyectos terminados que no le pagamos al editor todavía
  const toPayProjects = projects.filter(
    (p) => p.phase === "terminado" && p.pagado !== "pago_total"
  );

  // Cobros usan precio calculado (lo que nos debe el cliente).
  // Pagos usan cost (lo que le debemos al editor). Todo en USD.
  const toCollectTotal = sumPrice(toCollectProjects);
  const toPayTotal = sumCost(toPayProjects);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {projects.length} proyecto{projects.length === 1 ? "" : "s"} ·{" "}
          {clients.length} cliente{clients.length === 1 ? "" : "s"}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Activos"
          value={active}
          hint="Por asignar + Editando"
          href="/kanban"
        />
        <StatCard
          label="Por cobrar"
          value={toCollectProjects.length}
          hint={toCollectTotal > 0 ? formatPrice(toCollectTotal) : "Sin monto"}
          href="/finanzas"
          highlight
        />
        <StatCard
          label="Por pagar"
          value={toPayProjects.length}
          hint={toPayTotal > 0 ? formatPrice(toPayTotal) : "Sin monto"}
          href="/finanzas"
        />
        <StatCard
          label="Clientes"
          value={clients.length}
          hint="Cargados en la base"
          href="/clients"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Por fase
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PROJECT_PHASES.map((phase) => {
            const count = byPhase[phase] ?? 0;
            const pct =
              projects.length === 0 ? 0 : (count / projects.length) * 100;
            return (
              <Link
                key={phase}
                href="/kanban"
                className="group flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/30"
              >
                <span
                  className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_CLASS[phase]}`}
                >
                  {PHASE_LABEL[phase]}
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {count}
                </span>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
  href,
  highlight,
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className="group">
      <Card
        size="sm"
        className={`h-full transition-colors group-hover:bg-accent/30 ${highlight ? "ring-1 ring-primary/50" : ""}`}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </CardTitle>
          <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <span
            className={`text-3xl font-semibold tabular-nums ${highlight ? "text-primary" : ""}`}
          >
            {value}
          </span>
          {hint ? (
            <span className="text-xs text-muted-foreground truncate">
              {hint}
            </span>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

function countBy<T>(
  arr: T[],
  key: (item: T) => ProjectPhase
): Partial<Record<ProjectPhase, number>> {
  const acc: Partial<Record<ProjectPhase, number>> = {};
  for (const item of arr) {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
  }
  return acc;
}

function sumPrice(projects: ProjectWithRelations[]): number {
  let total = 0;
  for (const p of projects) {
    const price = computePrice(p);
    if (price != null) total += price;
  }
  return total;
}

function sumCost(projects: ProjectWithRelations[]): number {
  let total = 0;
  for (const p of projects) {
    const cost = computeCost(p);
    if (cost != null) total += cost;
  }
  return total;
}
