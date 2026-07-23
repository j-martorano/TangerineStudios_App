import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRightIcon, CirclePlayIcon, SquarePenIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  fetchClients,
  fetchProjects,
  fetchEditors,
} from "@/lib/projects/queries";
import {
  fetchClientPayments,
  fetchFixedServices,
  fetchServiceMonthEntries,
} from "@/lib/finanzas/queries";
import type { ProjectWithRelations } from "@/lib/projects/types";
import {
  computeCost,
  computePrice,
  formatPrice,
} from "@/lib/projects/format";
import { contrastColor } from "@/lib/clients/palette";

import {
  MonthNav,
  currentMonthKey,
  monthKeyOf,
  monthLabelUpper,
  shiftMonth,
  todayLabel,
} from "@/components/dashboard/month-nav";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { NewClientButton } from "@/components/clients/new-client-button";

export const dynamic = "force-dynamic";

type TaskType = "factura" | "cobro" | "pago";

const TASK_CHIP: Record<TaskType, { label: string; className: string }> = {
  factura: { label: "FACTURA", className: "bg-[#FFAC37] text-black" },
  cobro:   { label: "COBRO",   className: "bg-green-400 text-black" },
  pago:    { label: "PAGO",    className: "bg-red-500 text-white" },
};

const TASK_HREF: Record<TaskType, string> = {
  factura: "/facturas",
  cobro:   "/finanzas?tab=por_proyecto",
  pago:    "/finanzas?tab=por_proyecto",
};

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

  const [allProjects, clients, payments, editors, fixedServices, serviceMonthEntries] = await Promise.all([
    fetchProjects(),
    fetchClients(),
    fetchClientPayments(),
    fetchEditors(),
    fetchFixedServices(),
    fetchServiceMonthEntries(),
  ]);

  const projects = allProjects.filter((p) => !p.parent_id);

  const activeProjects = projects.filter(
    (p) =>
      !p.finalized &&
      !p.archived &&
      (p.phase === "por_asignar" ||
        p.phase === "editando" ||
        p.phase === "en_revision")
  );

  // Costo de servicios fijos para un mes dado (misma lógica que Finance page)
  function servicesCostForMonth(mk: string): number {
    const now = currentMonthKey();
    if (mk === now) {
      return fixedServices
        .filter((s) => s.active)
        .reduce((sum, s) => sum + s.monthly_cost, 0);
    }
    if (mk < now) {
      const entries = serviceMonthEntries.filter((e) => e.year_month === mk);
      return entries.reduce((sum, e) => sum + e.amount, 0);
    }
    return 0;
  }

  const rawMonthMetrics = computeMonthMetrics(projects, payments, selectedMonth);
  const rawPreviousMetrics = computeMonthMetrics(projects, payments, previousMonth);

  const monthMetrics = {
    ...rawMonthMetrics,
    profit: rawMonthMetrics.profit - servicesCostForMonth(selectedMonth),
  };
  const previousMetrics = {
    ...rawPreviousMetrics,
    profit: rawPreviousMetrics.profit - servicesCostForMonth(previousMonth),
  };

  const availableParents = projects
    .filter((p) => p.project_type === "pack" && !p.archived)
    .map((p) => ({ id: p.id, title: p.title, client_id: p.client_id }));

  type PanelItem = {
    id: string;
    chipLabel: string;
    chipClassName: string;
    chipStyle?: CSSProperties;
    title: string;
    href: string;
  };

  const activosItems: PanelItem[] = activeProjects.slice(0, 7).map((p) => {
    const bg = p.client?.color ?? "#666";
    return {
      id: p.id,
      chipLabel: p.client?.name ?? "—",
      chipClassName: "",
      chipStyle: { backgroundColor: bg, color: contrastColor(bg) },
      title: p.title,
      href: `/kanban?focus=${p.id}`,
    };
  });

  // Todas las tareas pendientes de TODOS los meses, agrupadas por mes
  const allFinalized = projects.filter(
    (p): p is ProjectWithRelations & { finalized_at: string } =>
      !!(p.finalized && p.finalized_at)
  );

  type RawTask = { project: ProjectWithRelations; taskType: TaskType; monthKey: string };

  const allRawTasks: RawTask[] = [
    ...allFinalized
      .filter((p) => p.invoiced !== "si")
      .map((p) => ({ project: p, taskType: "factura" as const, monthKey: monthKeyOf(new Date(p.finalized_at)) })),
    ...allFinalized
      .filter((p) => p.cobrado !== "si" && p.client?.payment_type !== "mensual")
      .map((p) => ({ project: p, taskType: "cobro" as const, monthKey: monthKeyOf(new Date(p.finalized_at)) })),
    ...allFinalized
      .filter((p) => p.pagado !== "pago_total" && p.editors.some((e) => e.editor != null))
      .map((p) => ({ project: p, taskType: "pago" as const, monthKey: monthKeyOf(new Date(p.finalized_at)) })),
  ];

  const taskMonthMap = new Map<string, RawTask[]>();
  for (const t of allRawTasks) {
    const arr = taskMonthMap.get(t.monthKey) ?? [];
    taskMonthMap.set(t.monthKey, [...arr, t]);
  }

  const taskSections = Array.from(taskMonthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // más reciente primero
    .map(([monthKey, tasks]) => ({
      monthLabel: monthLabelUpper(monthKey),
      items: tasks.map(({ project: p, taskType }) => ({
        id: `${p.id}-${taskType}`,
        chipLabel: TASK_CHIP[taskType].label,
        chipClassName: TASK_CHIP[taskType].className,
        title: p.title,
        href: TASK_HREF[taskType],
      })),
    }));

  return (
    <main className="flex w-full flex-col gap-6 p-6 md:p-8">
      {/* Encabezado del mes */}
      <header>
        <div className="flex items-center gap-3">
          <MonthNav current={selectedMonth} />
          <h1 className="text-5xl font-bold uppercase tracking-tight">
            {monthLabelUpper(selectedMonth)}
          </h1>
        </div>
        <p className="mt-1 text-sm font-light text-muted-foreground">
          {todayLabel()}
        </p>
      </header>

      {/* Stats principales + side stats */}
      <section className="flex gap-3">
        <div className="grid flex-1 grid-cols-3 gap-3">
          <GradientStatCard
            label="Total"
            value={formatPrice(monthMetrics.cobrado)}
            delta={moneyDelta(monthMetrics.cobrado, previousMetrics.cobrado)}
            blobColor="#37ACFF80"
          />
          <GradientStatCard
            label="Costos"
            value={formatPrice(monthMetrics.pagado)}
            delta={moneyDelta(monthMetrics.pagado, previousMetrics.pagado)}
            blobColor="#FF373780"
          />
          <GradientStatCard
            label="Ganancias"
            value={formatPrice(monthMetrics.profit)}
            delta={moneyDelta(monthMetrics.profit, previousMetrics.profit)}
            blobColor={monthMetrics.profit < 0 ? "#FF373780" : "#37FF6280"}
          />
        </div>

        {/* Stats laterales */}
        <div className="flex w-36 flex-col gap-2">
          <SideStatCard label="Clientes" value={clients.length} />
          <SideStatCard label="Proyectos" value={projects.filter(p => !p.archived).length} />
          <SideStatCard label="Editores" value={editors.length} />
        </div>
      </section>

      {/* Paneles ACTIVOS y TASKS */}
      <section className="grid grid-cols-2 gap-3">
        <ProjectPanel title="Activos" href="/kanban" icon={CirclePlayIcon} items={activosItems} />
        <ProjectPanel title="Tasks" href="/finanzas?tab=por_proyecto" icon={SquarePenIcon} sections={taskSections} />
      </section>

      {/* Acciones rápidas */}
      <footer className="flex items-center gap-3">
        <NewProjectButton
          editors={editors}
          clients={clients}
          availableParents={availableParents}
        />
        <NewClientButton
          buttonClassName="border border-white/15 bg-white/8 text-white/80 hover:bg-white/12 hover:text-white"
          availableEditors={editors}
          availableParents={clients.map((c) => ({ id: c.id, name: c.name }))}
        />
        <Link
          href="/facturas"
          className="inline-flex items-center gap-1.5 border border-white/15 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/12 hover:text-white"
          style={{ borderRadius: "6px" }}
        >
          Crear Factura
          <ArrowUpRightIcon className="size-3.5" />
        </Link>
      </footer>
    </main>
  );
}

// ---- Componentes de UI ----

function GradientStatCard({
  label,
  value,
  delta,
  blobColor,
}: {
  label: string;
  value: string;
  delta?: { raw: number; text: string };
  blobColor: string;
}) {
  const deltaColor =
    !delta
      ? ""
      : delta.raw > 0
        ? "text-emerald-400"
        : delta.raw < 0
          ? "text-red-400"
          : "text-muted-foreground";

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      {/* Blob — esquina superior derecha */}
      <div
        className="pointer-events-none absolute"
        style={{
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: blobColor,
          filter: "blur(65px)",
          bottom: -80,
          right: -70,
        }}
      />
      <div className="relative z-10 mt-auto flex flex-col gap-1">
        <span className="text-xs font-light uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-4xl font-bold tabular-nums">{value}</span>
        {delta ? (
          <span className={`text-xs font-semibold tabular-nums ${deltaColor}`}>
            {delta.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SideStatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-card px-4 py-2.5 ring-1 ring-foreground/10">
      <span className="text-[10px] font-light uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
    </div>
  );
}

type PanelItemBase = { id: string; chipLabel: string; chipClassName: string; chipStyle?: CSSProperties; title: string; href: string };

function ProjectPanel({
  title,
  href,
  icon: Icon,
  items,
  sections,
}: {
  title: string;
  href: string;
  icon: LucideIcon;
  items?: PanelItemBase[];
  sections?: Array<{ monthLabel: string; items: PanelItemBase[] }>;
}) {
  type Row =
    | { kind: "header"; label: string; key: string }
    | { kind: "item"; item: PanelItemBase; rowIdx: number };

  let rowIdx = 0;
  const rows: Row[] = sections
    ? sections.flatMap((s) => [
        { kind: "header" as const, label: s.monthLabel, key: `h-${s.monthLabel}` },
        ...s.items.map((item) => ({ kind: "item" as const, item, rowIdx: rowIdx++ })),
      ])
    : (items ?? []).map((item) => ({ kind: "item" as const, item, rowIdx: rowIdx++ }));

  const isEmpty = rows.filter((r) => r.kind === "item").length === 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4">
        <Icon className="size-5 shrink-0 text-foreground/60" />
        <span className="flex-1 text-base font-bold uppercase tracking-wide">
          {title}
        </span>
        <Link
          href={href}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowUpRightIcon className="size-4" />
        </Link>
      </div>

      {/* Body */}
      {isEmpty ? (
        <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
          Sin elementos
        </p>
      ) : (
        <ul className="max-h-[260px] overflow-y-auto">
          {rows.map((row) =>
            row.kind === "header" ? (
              <li
                key={row.key}
                className="border-t border-border bg-black/20 px-5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
              >
                {row.label}
              </li>
            ) : (
              <li
                key={row.item.id}
                className={`border-t border-border ${row.rowIdx % 2 === 1 ? "bg-white/[0.04]" : ""}`}
              >
                <Link
                  href={row.item.href}
                  className="flex items-center gap-3 px-5 py-2 transition-colors hover:bg-white/[0.05]"
                >
                  <span
                    className={`w-28 shrink-0 truncate rounded-md px-3 py-0.5 text-center text-[11px] font-bold uppercase tracking-wider ${row.item.chipClassName}`}
                    style={row.item.chipStyle}
                  >
                    {row.item.chipLabel}
                  </span>
                  <span className="shrink-0 text-muted-foreground">·</span>
                  <span className="min-w-0 truncate text-sm">{row.item.title}</span>
                </Link>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

// ---- Helpers de datos ----

function isValidMonthKey(s: string | undefined): boolean {
  return !!s && /^\d{4}-\d{2}$/.test(s);
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

  for (const p of projects) {
    const projectDate = p.finalized_at ?? p.created_at;
    if (!projectDate) continue;
    if (monthKeyOf(new Date(projectDate)) !== monthKey) continue;

    const isMensual = p.client?.payment_type === "mensual";

    // Cobros: solo cuando está marcado cobrado
    if (!isMensual && p.cobrado === "si") {
      const price = computePrice(p);
      if (price != null) { cobrado += price; profit += price; }
    }
    // Pagos: solo cuando está marcado pago_total
    if (p.pagado === "pago_total") {
      const cost = computeCost(p);
      if (cost != null) { pagado += cost; profit -= cost; }
    }
  }

  for (const pay of payments) {
    if (!pay.paid_at.startsWith(monthKey)) continue;
    cobrado += pay.amount;
    profit += pay.amount;
  }

  return { cobrado, pagado, profit };
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
