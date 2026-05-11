import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchClients, fetchProjects } from "@/lib/projects/queries";
import { PROJECT_STATUSES } from "@/lib/projects/types";
import type { CurrencyCode, ProjectStatus } from "@/lib/projects/types";
import { STATUS_CLASS, STATUS_LABEL, formatPrice } from "@/lib/projects/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projects, clients] = await Promise.all([
    fetchProjects(),
    fetchClients(),
  ]);

  const byStatus = countBy(projects, (p) => p.status);
  const active =
    (byStatus.pending ?? 0) +
    (byStatus.in_progress ?? 0) +
    (byStatus.revising ?? 0);
  const toCollect = byStatus.done ?? 0;
  const invoicedCount = byStatus.invoiced ?? 0;

  // Agrupado por moneda lo que está pendiente de cobro (status=done)
  const pendingByCurrency = sumByCurrency(
    projects.filter((p) => p.status === "done")
  );
  const invoicedByCurrency = sumByCurrency(
    projects.filter((p) => p.status === "invoiced")
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {projects.length} proyecto{projects.length === 1 ? "" : "s"} · {" "}
          {clients.length} cliente{clients.length === 1 ? "" : "s"}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Activos"
          value={active}
          hint="Sin empezar + En proceso + Corrigiendo"
          href="/kanban"
        />
        <StatCard
          label="Por cobrar"
          value={toCollect}
          hint={summaryByCurrency(pendingByCurrency)}
          href="/projects"
          highlight
        />
        <StatCard
          label="Facturados"
          value={invoicedCount}
          hint={summaryByCurrency(invoicedByCurrency)}
          href="/projects"
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
          Por estado
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {PROJECT_STATUSES.map((status) => {
            const count = byStatus[status] ?? 0;
            const pct =
              projects.length === 0 ? 0 : (count / projects.length) * 100;
            return (
              <Link
                key={status}
                href="/kanban"
                className="group flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/30"
              >
                <span
                  className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
                >
                  {STATUS_LABEL[status]}
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
  key: (item: T) => ProjectStatus
): Partial<Record<ProjectStatus, number>> {
  const acc: Partial<Record<ProjectStatus, number>> = {};
  for (const item of arr) {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
  }
  return acc;
}

function sumByCurrency(
  projects: { price: number | null; currency: CurrencyCode }[]
): Partial<Record<CurrencyCode, number>> {
  const acc: Partial<Record<CurrencyCode, number>> = {};
  for (const p of projects) {
    if (p.price == null) continue;
    acc[p.currency] = (acc[p.currency] ?? 0) + Number(p.price);
  }
  return acc;
}

function summaryByCurrency(
  totals: Partial<Record<CurrencyCode, number>>
): string {
  const parts: string[] = [];
  for (const c of ["ARS", "USD", "EUR"] as CurrencyCode[]) {
    if (totals[c]) parts.push(formatPrice(totals[c]!, c));
  }
  return parts.join(" · ") || "Sin monto";
}
