import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchClients, fetchProjects } from "@/lib/projects/queries";
import {
  fetchClientPayments,
  fetchFixedServices,
} from "@/lib/finanzas/queries";
import { fetchUserPrefs } from "@/lib/settings/queries";
import { FixedServicesSection } from "@/components/finanzas/fixed-services-section";
import { FinanzasTabs } from "@/components/finanzas/finanzas-tabs";
import { MonthCard } from "@/components/finanzas/month-card";
import { SettleRow } from "@/components/finanzas/settle-row";
import {
  MonthlyBarsChart,
  type MonthlyDatum,
} from "@/components/finanzas/monthly-bars-chart";
import {
  ClientIncomeDonut,
  type ClientIncomeDatum,
} from "@/components/finanzas/client-income-donut";
import {
  RegisterRetainerPaymentDialog,
  type RetainerClient,
} from "@/components/finanzas/register-retainer-payment-dialog";
import {
  computeCost,
  computePrice,
  computeProfit,
  formatPrice,
} from "@/lib/projects/format";
import { monthToneFromKey } from "@/lib/projects/month-colors";
import type { ProjectWithRelations } from "@/lib/projects/types";
import type { FinanzasPayment } from "@/lib/finanzas/queries";
import { ProjectSettleButton } from "@/components/finanzas/project-settle-button";

// Tinte de fondo basado en el color del cliente (mismo patrón que en
// proyectos: hex de 8 dígitos = RRGGBB + alpha 0x1f).
function clientTint(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  return `${hex}1f`;
}

export const dynamic = "force-dynamic";

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// Todos los montos en USD (moneda única).

type MonthBucket = {
  key: string;
  label: string;
  projects: ProjectWithRelations[];
  collected: number;
  pendingCollect: number;
  paid: number;
  pendingPay: number;
  profit: number;
  servicesCost: number;
};

type PaymentItem = {
  yearMonth: string;
  monthLabel: string;
  clientName: string;
  clientColor: string | null;
  amount: number;
  minutesCredited: number;
  note: string | null;
  paidAt: string;
};

type ProjectSettleItem = {
  yearMonth: string;
  monthLabel: string;
  projectId: string;
  projectCode: string;
  projectTitle: string;
  clientName: string;
  field: "cobrado" | "pagado";
  /** Valor total esperado (precio del cliente o cost agregado de editores). */
  total: number | null;
  /** Suma de los cobros/pagos registrados (o el total si está marcado saldado sin registros). */
  progress: number;
  /** Restante = total − progress, clamped a 0. */
  remaining: number | null;
  settled: boolean;
  /** Proyecto entero — necesario para abrir los managers inline. */
  project: ProjectWithRelations;
};

function monthKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(iso: string): string {
  return MONTH_FORMATTER.format(new Date(iso));
}

type BuildResult = {
  buckets: MonthBucket[];
  paymentItems: PaymentItem[];
  projectItems: ProjectSettleItem[];
};

function build(
  projects: ProjectWithRelations[],
  payments: FinanzasPayment[]
): BuildResult {
  const byKey = new Map<string, MonthBucket>();
  const paymentItems: PaymentItem[] = [];
  const projectItems: ProjectSettleItem[] = [];

  function ensureBucket(key: string, iso: string): MonthBucket {
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: monthLabel(iso),
        projects: [],
        collected: 0,
        pendingCollect: 0,
        paid: 0,
        pendingPay: 0,
        profit: 0,
        servicesCost: 0,
      });
    }
    return byKey.get(key)!;
  }

  // ====== Pagos de clientes mensuales — ingreso del mes en que se pagaron ======
  for (const pay of payments) {
    const key = monthKey(pay.paid_at);
    const bucket = ensureBucket(key, pay.paid_at);
    bucket.collected += pay.amount;
    bucket.profit += pay.amount;
    paymentItems.push({
      yearMonth: key,
      monthLabel: bucket.label,
      clientName: pay.clientName,
      clientColor: pay.clientColor,
      amount: pay.amount,
      minutesCredited: pay.minutes_credited,
      note: pay.note,
      paidAt: pay.paid_at,
    });
  }

  // ====== Proyectos finalizados — entran en el mes en que se finalizaron ======
  // Los shorts hijos de un pack no entran como entradas propias; el pack
  // padre los engloba (su cost ya suma los costos de los hijos vía
  // computeCost).
  for (const p of projects) {
    if (!p.finalized) continue;
    if (p.parent_id) continue;
    const monthIso = p.finalized_at ?? p.created_at;
    const key = monthKey(monthIso);
    const bucket = ensureBucket(key, monthIso);
    bucket.projects.push(p);

    const client = p.client;
    const isMensual = client?.payment_type === "mensual";

    // Cobros por proyecto — sólo clientes NO mensuales (los mensuales cobran
    // vía pagos). Incluye proyectos sin cliente linkeado.
    if (!isMensual) {
      const price = computePrice(p);
      const cobrosSum = p.cobros.reduce(
        (s, c) => s + Number(c.amount),
        0
      );
      const cobradoFlag = p.cobrado === "si";
      // Si está marcado «saldado» sin registrar cobros, tratamos el progreso
      // como completo (modo legacy del badge antes de los parciales).
      const progress =
        cobradoFlag && cobrosSum === 0 && price != null ? price : cobrosSum;
      const remaining =
        price != null ? Math.max(0, price - progress) : null;
      const settled =
        cobradoFlag || (remaining === 0 && progress > 0);

      bucket.collected += progress;
      if (remaining != null && !settled) bucket.pendingCollect += remaining;

      if (price != null || progress > 0) {
        projectItems.push({
          yearMonth: key,
          monthLabel: bucket.label,
          projectId: p.id,
          projectCode: p.project_code,
          projectTitle: p.title,
          clientName: client?.name ?? p.client_name ?? "Sin cliente",
          field: "cobrado",
          total: price,
          progress,
          remaining,
          settled,
          project: p,
        });
      }
    }

    // Pagos por proyecto — todos los editores aportan al costo. Si hay
    // pagos parciales registrados, sumamos los aportes; si no, fallback al
    // flag pagado === 'pago_total'.
    const hasEditor = p.editors.some((e) => e.editor != null);
    if (hasEditor) {
      const cost = computeCost(p);
      const pagosSum = p.editor_pagos.reduce(
        (s, e) => s + Number(e.amount),
        0
      );
      const pagoFlag = p.pagado === "pago_total";
      const progress =
        pagoFlag && pagosSum === 0 && cost != null ? cost : pagosSum;
      const remaining =
        cost != null ? Math.max(0, cost - progress) : null;
      const settled = pagoFlag || (remaining === 0 && progress > 0);

      bucket.paid += progress;
      if (remaining != null && !settled) bucket.pendingPay += remaining;

      if (cost != null || progress > 0) {
        projectItems.push({
          yearMonth: key,
          monthLabel: bucket.label,
          projectId: p.id,
          projectCode: p.project_code,
          projectTitle: p.title,
          clientName: client?.name ?? p.client_name ?? "—",
          field: "pagado",
          total: cost,
          progress,
          remaining,
          settled,
          project: p,
        });
      }
    }

    // Ganancia: para clientes no mensuales, precio − costo. Para mensuales,
    // sólo resta el costo de edición (el ingreso son los pagos del retainer).
    if (isMensual) {
      const cost = computeCost(p);
      if (cost != null) bucket.profit -= cost;
    } else {
      const profit = computeProfit(p);
      if (profit != null) bucket.profit += profit;
    }
  }

  const buckets = Array.from(byKey.values()).sort((a, b) =>
    b.key.localeCompare(a.key)
  );

  paymentItems.sort((a, b) => {
    if (a.yearMonth !== b.yearMonth)
      return b.yearMonth.localeCompare(a.yearMonth);
    return b.paidAt.localeCompare(a.paidAt);
  });

  // Pendientes primero, después saldados; dentro de cada grupo por mes y monto.
  projectItems.sort((a, b) => {
    if (a.settled !== b.settled) return a.settled ? 1 : -1;
    if (a.yearMonth !== b.yearMonth)
      return b.yearMonth.localeCompare(a.yearMonth);
    return (b.remaining ?? b.total ?? 0) - (a.remaining ?? a.total ?? 0);
  });

  return { buckets, paymentItems, projectItems };
}

function sumAcrossBuckets(
  buckets: MonthBucket[],
  field: keyof Pick<
    MonthBucket,
    "collected" | "pendingCollect" | "paid" | "pendingPay" | "profit"
  >
): number {
  let total = 0;
  for (const b of buckets) total += b[field];
  return total;
}

type SearchParams = Promise<{ tab?: string }>;

const ALLOWED_TABS = new Set([
  "resumen",
  "por_mes",
  "pagos",
  "por_proyecto",
  "servicios",
]);

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const initialTab =
    params.tab && ALLOWED_TABS.has(params.tab)
      ? (params.tab as
          | "resumen"
          | "por_mes"
          | "pagos"
          | "por_proyecto"
          | "servicios")
      : null;

  const [projects, payments, fixedServices, prefs, clients] =
    await Promise.all([
      fetchProjects(),
      fetchClientPayments(),
      fetchFixedServices(),
      fetchUserPrefs(),
      fetchClients(),
    ]);

  const retainerClients: RetainerClient[] = clients
    .filter((c) => c.payment_type === "mensual")
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      rate: c.agreed_price != null ? Number(c.agreed_price) : null,
      discountPct: Number(c.retainer_discount_pct),
    }));
  const { buckets, paymentItems, projectItems } = build(projects, payments);

  // Servicios fijos activos: su costo mensual se resta de la ganancia de
  // cada mes con actividad.
  const servicesMonthlyTotal = fixedServices
    .filter((s) => s.active)
    .reduce((sum, s) => sum + s.monthly_cost, 0);
  for (const b of buckets) {
    b.servicesCost = servicesMonthlyTotal;
    b.profit -= servicesMonthlyTotal;
  }

  const totalCollected = sumAcrossBuckets(buckets, "collected");
  const totalPendingCollect = sumAcrossBuckets(buckets, "pendingCollect");
  const totalPaid = sumAcrossBuckets(buckets, "paid");
  const totalPendingPay = sumAcrossBuckets(buckets, "pendingPay");
  const totalProfit = sumAcrossBuckets(buckets, "profit");

  // Datos para los gráficos del Resumen.
  const SHORT_MONTH = new Intl.DateTimeFormat("es-AR", {
    month: "short",
    timeZone: "UTC",
  });
  function shortMonthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return `${SHORT_MONTH.format(d).replace(".", "")} ${y % 100}`;
  }

  const sortedBuckets = [...buckets].sort((a, b) => a.key.localeCompare(b.key));
  const last12 = sortedBuckets.slice(-12);
  const monthlyData: MonthlyDatum[] = last12.map((b) => ({
    month: shortMonthLabel(b.key),
    cobrado: Math.round(b.collected),
    porCobrar: Math.round(b.pendingCollect),
    pagado: Math.round(b.paid),
    ganancia: Math.round(b.profit),
  }));

  // ── Ingresos por cliente: pagos retainer + proyectos finalizados cobrados ──
  const incomeByClient = new Map<string, { color: string; total: number }>();
  for (const pay of payments) {
    const existing = incomeByClient.get(pay.clientName);
    if (existing) existing.total += pay.amount;
    else
      incomeByClient.set(pay.clientName, {
        color: pay.clientColor ?? "#888888",
        total: pay.amount,
      });
  }
  for (const p of projects) {
    if (!p.finalized) continue;
    if (p.parent_id) continue;
    if (p.cobrado !== "si") continue;
    if (p.client?.payment_type === "mensual") continue;
    const price = computePrice(p);
    if (price == null) continue;
    const name = p.client?.name ?? p.client_name ?? "Sin cliente";
    const color = p.client?.color ?? "#888888";
    const existing = incomeByClient.get(name);
    if (existing) existing.total += price;
    else incomeByClient.set(name, { color, total: price });
  }
  const TOP_CLIENTS = 5;
  const rankedClients = [...incomeByClient.entries()]
    .map(([name, { color, total }]) => ({ name, color, value: total }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const clientIncomeData: ClientIncomeDatum[] = rankedClients.slice(0, TOP_CLIENTS);
  if (rankedClients.length > TOP_CLIENTS) {
    const rest = rankedClients.slice(TOP_CLIENTS);
    clientIncomeData.push({
      name: "Otros",
      color: "#94a3b8",
      value: rest.reduce((s, r) => s + r.value, 0),
    });
  }

  // ── Costos por cliente: costo de editores en proyectos finalizados ──
  const costByClientMap = new Map<string, { color: string; total: number }>();
  for (const p of projects) {
    if (!p.finalized) continue;
    if (p.parent_id) continue;
    const cost = computeCost(p);
    if (cost == null || cost === 0) continue;
    const name = p.client?.name ?? p.client_name ?? "Sin cliente";
    const color = p.client?.color ?? "#888888";
    const existing = costByClientMap.get(name);
    if (existing) existing.total += cost;
    else costByClientMap.set(name, { color, total: cost });
  }
  const rankedCostClients = [...costByClientMap.entries()]
    .map(([name, { color, total }]) => ({ name, color, value: total }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const clientCostData: ClientIncomeDatum[] = rankedCostClients.slice(0, TOP_CLIENTS);
  if (rankedCostClients.length > TOP_CLIENTS) {
    const rest = rankedCostClients.slice(TOP_CLIENTS);
    clientCostData.push({
      name: "Otros",
      color: "#94a3b8",
      value: rest.reduce((s, r) => s + r.value, 0),
    });
  }

  // ── Ganancias por cliente: ingreso − costo (puede ser negativo) ──
  const allClientNames = new Set([
    ...incomeByClient.keys(),
    ...costByClientMap.keys(),
  ]);
  const clientProfitData: ClientIncomeDatum[] = [];
  for (const name of allClientNames) {
    const income = incomeByClient.get(name)?.total ?? 0;
    const cost = costByClientMap.get(name)?.total ?? 0;
    const color =
      incomeByClient.get(name)?.color ??
      costByClientMap.get(name)?.color ??
      "#888888";
    clientProfitData.push({ name, color, value: income - cost });
  }
  clientProfitData.sort((a, b) => b.value - a.value);

  const resumenSection = (
    <div className="flex flex-col gap-6">
      {/* Fila 1: KPIs */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <TotalCard
          label="Cobrado"
          value={formatPrice(totalCollected)}
          tone="positive"
        />
        <TotalCard
          label="Por cobrar"
          value={formatPrice(totalPendingCollect)}
          tone="warning"
        />
        <TotalCard
          label="Pagado"
          value={formatPrice(totalPaid)}
          tone="neutral"
        />
        <TotalCard
          label="Por pagar"
          value={formatPrice(totalPendingPay)}
          tone="warning"
        />
        <TotalCard
          label="Servicios / mes"
          value={formatPrice(servicesMonthlyTotal)}
          tone="neutral"
        />
        <TotalCard
          label="Ganancia"
          value={formatPrice(totalProfit)}
          tone={totalProfit < 0 ? "negative" : "positive"}
        />
      </section>

      {/* Fila 2: Gráfico de barras por mes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Cobrado / Pagado / Ganancia por mes
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Últimos {monthlyData.length} mes
            {monthlyData.length === 1 ? "" : "es"} con actividad.
          </p>
        </CardHeader>
        <CardContent>
          <MonthlyBarsChart data={monthlyData} />
        </CardContent>
      </Card>

      {/* Fila 3: Tres donuts por cliente */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ingresos por cliente</CardTitle>
            <p className="text-xs text-muted-foreground">
              Retainer + cobros por proyecto.
            </p>
          </CardHeader>
          <CardContent>
            <ClientIncomeDonut
              data={clientIncomeData}
              emptyMessage="Sin ingresos cargados todavía."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Costos por cliente</CardTitle>
            <p className="text-xs text-muted-foreground">
              Pagos a editores en proyectos finalizados.
            </p>
          </CardHeader>
          <CardContent>
            <ClientIncomeDonut
              data={clientCostData}
              emptyMessage="Sin costos registrados todavía."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ganancias por cliente</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ingreso − costo por cliente.
            </p>
          </CardHeader>
          <CardContent>
            <ClientIncomeDonut
              data={clientProfitData}
              allowNegative
              emptyMessage="Sin datos suficientes todavía."
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );

  const now = new Date();
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const porMesSection =
    buckets.length === 0 ? (
      <p className="text-sm italic text-muted-foreground">
        No hay actividad cargada todavía.
      </p>
    ) : (
      <div className="flex flex-col gap-3">
        {buckets.map((b) => (
          <MonthCard
            key={b.key}
            monthKey={b.key}
            label={b.label}
            collected={b.collected}
            pendingCollect={b.pendingCollect}
            paid={b.paid}
            pendingPay={b.pendingPay}
            profit={b.profit}
            servicesCost={b.servicesCost}
            projects={b.projects}
            defaultOpen={b.key === currentMonthKey}
          />
        ))}
      </div>
    );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">
          {buckets.length} mes{buckets.length === 1 ? "" : "es"} con actividad
        </p>
      </header>

      <FinanzasTabs
        visibleTabs={prefs.finanzas.tabs}
        initialTab={initialTab}
        sections={{
          resumen: resumenSection,
          por_mes: porMesSection,
          pagos: (
            <PagosSection
              items={paymentItems}
              retainerClients={retainerClients}
            />
          ),
          por_proyecto: <ProjectsSection items={projectItems} />,
          servicios: <FixedServicesSection services={fixedServices} />,
        }}
      />
    </main>
  );
}

function TotalCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "warning" | "neutral" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-500"
      : tone === "warning"
        ? "text-amber-500"
        : tone === "negative"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span className={`text-base font-semibold tabular-nums ${toneClass}`}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function fmtMin(n: number): string {
  const rounded = Number.isInteger(n) ? n : Number(n.toFixed(1));
  return `${rounded} min`;
}

function cobradoColor(status: ProjectWithRelations["cobrado"]): string {
  if (status === "si") return "text-emerald-500";
  if (status === "parcial") return "text-amber-500";
  return "text-muted-foreground";
}

function pagadoColor(status: ProjectWithRelations["pagado"]): string {
  if (status === "pago_total") return "text-emerald-500";
  if (status === "parcial") return "text-amber-500";
  return "text-muted-foreground";
}

function PagosSection({
  items,
  retainerClients,
}: {
  items: PaymentItem[];
  retainerClients: RetainerClient[];
}) {
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pagos de clientes retainer
          </h2>
          <span className="text-xs text-muted-foreground">
            {items.length} pago{items.length === 1 ? "" : "s"} ·{" "}
            {formatPrice(total)}
          </span>
        </div>
        <RegisterRetainerPaymentDialog clients={retainerClients} />
      </div>
      {items.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          No hay pagos registrados todavía. Tocá «Registrar pago» para cargar
          el primero.
        </p>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border/40 p-0">
            {items.map((it, i) => (
              <div
                key={`${it.paidAt}-${it.clientName}-${i}`}
                style={{ backgroundColor: clientTint(it.clientColor) }}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {it.clientColor ? (
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: it.clientColor }}
                    />
                  ) : null}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {it.clientName}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {it.monthLabel} · {fmtMin(it.minutesCredited)}
                      {it.note ? ` · ${it.note}` : ""}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatPrice(it.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function ProjectsSection({ items }: { items: ProjectSettleItem[] }) {
  const cobrarItems = items.filter((i) => i.field === "cobrado");
  const pagarItems = items.filter((i) => i.field === "pagado");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Por proyecto
      </h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ProjectList
          title="Cobros"
          subtitle="clientes (por proyecto / por rate)"
          items={cobrarItems}
        />
        <ProjectList
          title="Pagos"
          subtitle="editores"
          items={pagarItems}
        />
      </div>
    </section>
  );
}

function ProjectList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: ProjectSettleItem[];
}) {
  const pendientes = items.filter((i) => !i.settled).length;
  const totalRemaining = items
    .filter((i) => !i.settled && i.remaining != null)
    .reduce((s, i) => s + (i.remaining ?? 0), 0);
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-baseline justify-between gap-2 text-sm font-medium">
          {title}
          {totalRemaining > 0 ? (
            <span className="text-xs font-normal text-amber-500 tabular-nums">
              {formatPrice(totalRemaining)} pendiente
            </span>
          ) : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {pendientes} pendiente{pendientes === 1 ? "" : "s"} · {items.length}{" "}
          {subtitle}
        </p>
      </CardHeader>
      <CardContent className="divide-y divide-border/40 p-0">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs italic text-muted-foreground">
            No hay proyectos finalizados con monto computable.
          </p>
        ) : (
          items.map((it) => (
            <SettleRow key={`${it.projectId}-${it.field}`} item={it} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

