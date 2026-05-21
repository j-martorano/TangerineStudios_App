import Link from "next/link";

import { fetchClients, fetchProjects } from "@/lib/projects/queries";
import { fetchClientPayments } from "@/lib/finanzas/queries";
import { PROJECT_PHASES } from "@/lib/projects/types";
import type { ProjectPhase, ProjectWithRelations } from "@/lib/projects/types";
import {
  PHASE_CLASS,
  PHASE_LABEL,
  computeCost,
  computePrice,
  formatPrice,
} from "@/lib/projects/format";

import {
  MonthNav,
  currentMonthKey,
  monthKeyOf,
  monthLabelUpper,
  shiftMonth,
} from "@/components/dashboard/month-nav";
import { StatCard, type StatCardItem } from "@/components/dashboard/stat-card";
import {
  RetainerClientsSection,
  type RetainerClientSummary,
} from "@/components/dashboard/retainer-clients-section";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const selectedMonth = isValidMonthKey(params.month)
    ? (params.month as string)
    : currentMonthKey();
  const previousMonth = shiftMonth(selectedMonth, -1);

  const [allProjects, clients, payments] = await Promise.all([
    fetchProjects(),
    fetchClients(),
    fetchClientPayments(),
  ]);

  // En el dashboard los stats se calculan sobre top-level (packs +
  // proyectos sueltos). Los shorts hijos no se cuentan sueltos — su info
  // aporta al pack vía computeCost.
  const projects = allProjects.filter((p) => !p.parent_id);

  // Snapshot global (no depende del mes seleccionado).
  const byPhase = countByPhase(projects);
  const activeProjects = projects.filter(
    (p) =>
      !p.finalized &&
      !p.archived &&
      (p.phase === "por_asignar" || p.phase === "editando")
  );

  // Métricas del mes seleccionado y del previo.
  const monthMetrics = computeMonthMetrics(projects, payments, selectedMonth);
  const previousMetrics = computeMonthMetrics(
    projects,
    payments,
    previousMonth
  );

  // Pendientes del mes (cobrado != si / pagado != pago_total en proyectos
  // finalizados en el mes).
  const pendingCobroProjects = projects.filter(
    (p) =>
      p.finalized &&
      p.finalized_at &&
      monthKeyOf(new Date(p.finalized_at)) === selectedMonth &&
      p.cobrado !== "si" &&
      p.client?.payment_type !== "mensual"
  );
  const pendingPagoProjects = projects.filter(
    (p) =>
      p.finalized &&
      p.finalized_at &&
      monthKeyOf(new Date(p.finalized_at)) === selectedMonth &&
      p.pagado !== "pago_total" &&
      p.editors.some((e) => e.editor != null)
  );

  const pendingCobroTotal = sumPrice(pendingCobroProjects);
  const pendingPagoTotal = sumCost(pendingPagoProjects);
  const previousPendingCobro = sumPrice(
    projects.filter(
      (p) =>
        p.finalized &&
        p.finalized_at &&
        monthKeyOf(new Date(p.finalized_at)) === previousMonth &&
        p.cobrado !== "si" &&
        p.client?.payment_type !== "mensual"
    )
  );
  const previousPendingPago = sumCost(
    projects.filter(
      (p) =>
        p.finalized &&
        p.finalized_at &&
        monthKeyOf(new Date(p.finalized_at)) === previousMonth &&
        p.pagado !== "pago_total" &&
        p.editors.some((e) => e.editor != null)
    )
  );

  // Clientes activos (con al menos 1 proyecto creado en el mes).
  const monthClientIds = new Set(
    projects
      .filter((p) => monthKeyOf(new Date(p.created_at)) === selectedMonth)
      .map((p) => p.client_id)
      .filter((id): id is string => Boolean(id))
  );
  const previousClientIds = new Set(
    projects
      .filter((p) => monthKeyOf(new Date(p.created_at)) === previousMonth)
      .map((p) => p.client_id)
      .filter((id): id is string => Boolean(id))
  );

  // Resumen retainer: último pago + saldo por cliente mensual. `payments` de
  // fetchClientPayments no expone client_id, así que matcheamos por nombre.
  const retainerClients: RetainerClientSummary[] = clients
    .filter((c) => c.payment_type === "mensual")
    .map((c) => {
      const last = payments
        .filter((pay) => pay.clientName === c.name)
        .map((pay) => pay.paid_at)
        .sort()
        .at(-1) ?? null;
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        minute_balance: c.minute_balance,
        lastPaymentAt: last,
      };
    });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} cliente{clients.length === 1 ? "" : "s"} ·{" "}
            {projects.length} proyecto{projects.length === 1 ? "" : "s"}
          </p>
        </div>
        <MonthNav current={selectedMonth} />
      </header>

      {/* Resumen del mes — números netos del mes con delta vs mes anterior. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryRow
          label="Cobrado del mes"
          value={formatPrice(monthMetrics.cobrado)}
          delta={moneyDelta(monthMetrics.cobrado, previousMetrics.cobrado)}
          tone="positive"
        />
        <SummaryRow
          label="Pagado del mes"
          value={formatPrice(monthMetrics.pagado)}
          delta={moneyDelta(monthMetrics.pagado, previousMetrics.pagado)}
          tone="neutral"
        />
        <SummaryRow
          label="Ganancia del mes"
          value={formatPrice(monthMetrics.profit)}
          delta={moneyDelta(monthMetrics.profit, previousMetrics.profit)}
          tone={monthMetrics.profit < 0 ? "negative" : "positive"}
        />
      </section>

      {/* Cards operativas con info breve. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Activos ahora"
          value={String(activeProjects.length)}
          hint="Por asignar + Editando"
          items={projectItems(activeProjects.slice(0, 3), "phase-label")}
          href="/kanban"
          hrefLabel="Ir al kanban"
        />
        <StatCard
          label={`Por cobrar — ${monthLabelUpper(selectedMonth)}`}
          value={
            pendingCobroTotal > 0
              ? formatPrice(pendingCobroTotal)
              : `${pendingCobroProjects.length}`
          }
          hint={
            pendingCobroProjects.length === 0
              ? "Todo cobrado"
              : `${pendingCobroProjects.length} proyecto${pendingCobroProjects.length === 1 ? "" : "s"}`
          }
          delta={moneyDelta(pendingCobroTotal, previousPendingCobro)}
          items={projectItems(pendingCobroProjects.slice(0, 3), "price")}
          href="/finanzas?tab=por_proyecto"
          hrefLabel="Ver en Finanzas"
          highlight={pendingCobroTotal > 0}
        />
        <StatCard
          label={`Por pagar — ${monthLabelUpper(selectedMonth)}`}
          value={
            pendingPagoTotal > 0
              ? formatPrice(pendingPagoTotal)
              : `${pendingPagoProjects.length}`
          }
          hint={
            pendingPagoProjects.length === 0
              ? "Todo pagado"
              : `${pendingPagoProjects.length} proyecto${pendingPagoProjects.length === 1 ? "" : "s"}`
          }
          delta={moneyDelta(pendingPagoTotal, previousPendingPago)}
          items={projectItems(pendingPagoProjects.slice(0, 3), "cost")}
          href="/finanzas?tab=por_proyecto"
          hrefLabel="Ver en Finanzas"
        />
        <StatCard
          label={`Clientes del mes`}
          value={String(monthClientIds.size)}
          hint={`Distintos con proyectos en ${monthLabelUpper(selectedMonth)}`}
          delta={countDelta(monthClientIds.size, previousClientIds.size)}
          href="/clients"
          hrefLabel="Ver clientes"
        />
      </section>

      <RetainerClientsSection clients={retainerClients} />

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

// ---- Helpers ----

function isValidMonthKey(s: string | undefined): boolean {
  return !!s && /^\d{4}-\d{2}$/.test(s);
}

function countByPhase(
  projects: ProjectWithRelations[]
): Partial<Record<ProjectPhase, number>> {
  const acc: Partial<Record<ProjectPhase, number>> = {};
  for (const p of projects) {
    if (p.archived) continue;
    acc[p.phase] = (acc[p.phase] ?? 0) + 1;
  }
  return acc;
}

type MonthMetrics = {
  cobrado: number;
  pagado: number;
  profit: number;
};

function computeMonthMetrics(
  projects: ProjectWithRelations[],
  payments: { amount: number; paid_at: string }[],
  monthKey: string
): MonthMetrics {
  let cobrado = 0;
  let pagado = 0;
  let profit = 0;

  // Proyectos finalizados en el mes.
  for (const p of projects) {
    if (!p.finalized || !p.finalized_at) continue;
    if (monthKeyOf(new Date(p.finalized_at)) !== monthKey) continue;

    const isMensual = p.client?.payment_type === "mensual";

    if (!isMensual && p.cobrado === "si") {
      const price = computePrice(p);
      if (price != null) cobrado += price;
    }
    if (p.pagado === "pago_total") {
      const cost = computeCost(p);
      if (cost != null) pagado += cost;
    }
    if (isMensual) {
      const cost = computeCost(p);
      if (cost != null) profit -= cost;
    } else {
      const price = computePrice(p);
      const cost = computeCost(p);
      if (price != null && cost != null) profit += price - cost;
      else if (price != null) profit += price;
    }
  }

  // Pagos retainer recibidos en el mes.
  for (const pay of payments) {
    if (!pay.paid_at.startsWith(monthKey)) continue;
    cobrado += pay.amount;
    profit += pay.amount;
  }

  return { cobrado, pagado, profit };
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

function projectItems(
  projects: ProjectWithRelations[],
  mode: "phase-label" | "price" | "cost"
): StatCardItem[] {
  return projects.map((p) => {
    let secondary: string | undefined;
    if (mode === "phase-label") {
      secondary = PHASE_LABEL[p.phase];
    } else if (mode === "price") {
      const price = computePrice(p);
      secondary = price != null ? formatPrice(price) : undefined;
    } else if (mode === "cost") {
      const cost = computeCost(p);
      secondary = cost != null ? formatPrice(cost) : undefined;
    }
    return {
      primary: p.title,
      secondary,
      color: p.client?.color ?? null,
    };
  });
}

function moneyDelta(
  current: number,
  previous: number
): { raw: number; text: string } | undefined {
  const raw = current - previous;
  if (raw === 0 && previous === 0) return undefined;
  const sign = raw > 0 ? "+" : raw < 0 ? "−" : "";
  const abs = Math.abs(raw);
  return { raw, text: `${sign}${formatPrice(abs)}` };
}

function countDelta(
  current: number,
  previous: number
): { raw: number; text: string } | undefined {
  const raw = current - previous;
  if (raw === 0) return undefined;
  const sign = raw > 0 ? "+" : "−";
  return { raw, text: `${sign}${Math.abs(raw)}` };
}

function SummaryRow({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta?: { raw: number; text: string };
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-500"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-3">
        <span className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
          {value}
        </span>
        {delta ? (
          <span
            className={`text-[11px] font-medium tabular-nums ${
              delta.raw > 0
                ? "text-emerald-500"
                : delta.raw < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
            title="vs mes anterior"
          >
            {delta.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
