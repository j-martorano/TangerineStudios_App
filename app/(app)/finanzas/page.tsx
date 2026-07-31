import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchClients, fetchProjects } from "@/lib/projects/queries";
import {
  fetchClientPayments,
  fetchFixedServices,
  fetchServiceMonthEntries,
} from "@/lib/finanzas/queries";
import { fetchUserPrefs } from "@/lib/settings/queries";
import { FixedServicesSection } from "@/components/finanzas/fixed-services-section";
import { FinanzasTabs } from "@/components/finanzas/finanzas-tabs";
import { MonthCard } from "@/components/finanzas/month-card";
import { SettleRow } from "@/components/finanzas/settle-row";
import { FinanzasLineChart, type ChartPoint } from "@/components/finanzas/finanzas-line-chart";
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
  formatPrice,
} from "@/lib/projects/format";
import { monthToneFromKey } from "@/lib/projects/month-colors";
import type { ProjectWithRelations } from "@/lib/projects/types";
import type { FinanzasPayment } from "@/lib/finanzas/queries";
import { ProjectSettleButton } from "@/components/finanzas/project-settle-button";

// Tinte de fondo basado en el color del cliente (hex de 8 dígitos = RRGGBB + alpha 0x33).
function clientTint(hex: string | null | undefined): string | undefined {
  if (!hex) return undefined;
  return `${hex}33`;
}


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

/**
 * Rellena los meses sin actividad entre el primer bucket existente y el mes
 * actual, para que los servicios fijos se descuenten también en esos meses.
 * Devuelve todos los buckets ordenados de más nuevo a más viejo.
 */
function fillMonthGaps(buckets: MonthBucket[]): MonthBucket[] {
  if (buckets.length === 0) return buckets;

  const byKey = new Map(buckets.map((b) => [b.key, b]));

  const now = new Date();
  const cy = now.getUTCFullYear();
  const cm = now.getUTCMonth() + 1;

  // Mes de inicio: el más antiguo con actividad
  const firstKey = [...byKey.keys()].sort()[0];
  let [y, m] = firstKey.split("-").map(Number);

  const result: MonthBucket[] = [];
  while (y < cy || (y === cy && m <= cm)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    result.push(
      byKey.get(key) ?? {
        key,
        label: monthLabel(`${key}-01T00:00:00Z`),
        projects: [],
        collected: 0,
        pendingCollect: 0,
        paid: 0,
        pendingPay: 0,
        profit: 0,
        servicesCost: 0,
      }
    );
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return result.sort((a, b) => b.key.localeCompare(a.key));
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

  // ====== Proyectos — entran en el mes según finalized_at o created_at ======
  // Los hijos de un pack no entran como entradas propias; el pack padre los
  // engloba (su cost ya suma los costos de los hijos vía computeCost).
  // Un proyecto se refleja en cobros/pagos SOLO cuando está marcado cobrado/pagado.
  for (const p of projects) {
    if (p.parent_id) continue;
    const monthIso = p.finalized_at ?? p.created_at;
    if (!monthIso) continue;
    const key = monthKey(monthIso);
    const bucket = ensureBucket(key, monthIso);
    bucket.projects.push(p);

    const client = p.client;
    const isMensual = client?.payment_type === "mensual";

    // Cobros por proyecto — sólo clientes NO mensuales. Se reflejan SOLO cuando
    // el proyecto está marcado cobrado === "si".
    if (!isMensual) {
      const price = computePrice(p);
      const cobrosSum = p.cobros.reduce(
        (s, c) => s + Number(c.amount),
        0
      );
      const cobradoFlag = p.cobrado === "si";

      if (cobradoFlag && price != null) {
        bucket.collected += price;
      } else if (price != null) {
        bucket.pendingCollect += Math.max(0, price - cobrosSum);
      }

      // Settle rows: muestran progreso parcial para tracking interno
      const progress =
        cobradoFlag && cobrosSum === 0 && price != null ? price : cobrosSum;
      const remaining =
        price != null ? Math.max(0, price - progress) : null;
      const settled = cobradoFlag;

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

    // Pagos por proyecto — se reflejan SOLO cuando está marcado pagado === "pago_total".
    const hasEditor = p.editors.some((e) => e.editor != null);
    if (hasEditor) {
      const cost = computeCost(p);
      const pagosSum = p.editor_pagos.reduce(
        (s, e) => s + Number(e.amount),
        0
      );
      const pagoFlag = p.pagado === "pago_total";

      if (pagoFlag && cost != null) {
        bucket.paid += cost;
      } else if (cost != null) {
        bucket.pendingPay += Math.max(0, cost - pagosSum);
      }

      const progress =
        pagoFlag && pagosSum === 0 && cost != null ? cost : pagosSum;
      const remaining =
        cost != null ? Math.max(0, cost - progress) : null;
      const settled = pagoFlag;

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

    // Ganancia: ingreso cobrado menos costo del proyecto (independiente del pago al editor)
    if (!isMensual && p.cobrado === "si") {
      const price = computePrice(p);
      if (price != null) bucket.profit += price;
      const cost = computeCost(p);
      if (cost != null) bucket.profit -= cost;
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
  "cobros_pendientes",
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
          | "cobros_pendientes"
          | "servicios")
      : null;

  const [projects, payments, fixedServices, prefs, clients, serviceMonthEntries] =
    await Promise.all([
      fetchProjects(),
      fetchClientPayments(),
      fetchFixedServices(),
      fetchUserPrefs(),
      fetchClients(),
      fetchServiceMonthEntries(),
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
  // Mes actual — definido aquí para usarlo tanto en los cálculos de servicios
  // como en la UI (por_mes defaultOpen, Servicios tab, etc.).
  const now = new Date();
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const { buckets: rawBuckets, paymentItems, projectItems } = build(projects, payments);

  // ── Servicios fijos por mes ───────────────────────────────────────────────
  // Meses pasados: se leen de service_month_entries (editables en la UI).
  // Mes actual: se deriva en vivo de los servicios activos.
  // Meses sin entradas en DB = no se descuenta nada (el usuario no los registró).

  // Índice: year_month → service_id → amount
  const entriesByMonth = new Map<string, Map<string, number>>();
  for (const e of serviceMonthEntries) {
    if (!entriesByMonth.has(e.year_month))
      entriesByMonth.set(e.year_month, new Map());
    entriesByMonth.get(e.year_month)!.set(e.service_id, e.amount);
  }

  const activeServices = fixedServices.filter((s) => s.active);
  const servicesMonthlyTotal = activeServices.reduce(
    (sum, s) => sum + s.monthly_cost,
    0
  );

  const buckets = fillMonthGaps(rawBuckets);
  for (const b of buckets) {
    if (b.key === currentMonthKey) {
      // Mes actual: activos
      if (servicesMonthlyTotal > 0) {
        b.servicesCost = servicesMonthlyTotal;
        b.profit -= servicesMonthlyTotal;
      }
    } else if (b.key < currentMonthKey) {
      // Mes pasado: entradas guardadas en DB
      const monthMap = entriesByMonth.get(b.key);
      if (monthMap && monthMap.size > 0) {
        const total = [...monthMap.values()].reduce((s, a) => s + a, 0);
        if (total > 0) {
          b.servicesCost = total;
          b.profit -= total;
        }
      }
    }
  }

  // ── monthlyApplication: prop para el tab Servicios ────────────────────────
  type AppEntry = { service_id: string; name: string; amount: number };
  const monthlyApplication = buckets.map((b) => {
    const isPast = b.key < currentMonthKey;
    const monthMap = isPast ? entriesByMonth.get(b.key) : null;
    const isSeeded = monthMap != null && monthMap.size > 0;

    let entries: AppEntry[];
    if (!isPast) {
      entries = activeServices.map((s) => ({
        service_id: s.id,
        name: s.name,
        amount: s.monthly_cost,
      }));
    } else if (isSeeded) {
      entries = [...monthMap!.entries()].map(([sid, amount]) => {
        const svc = fixedServices.find((s) => s.id === sid);
        return { service_id: sid, name: svc?.name ?? "Servicio eliminado", amount };
      });
    } else {
      entries = [];
    }

    return { key: b.key, label: b.label, servicesCost: b.servicesCost, isPast, isSeeded, entries };
  });

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

  const monthlyChartData: ChartPoint[] = sortedBuckets.map((b) => ({
    label: shortMonthLabel(b.key),
    cobrado: Math.round(b.collected),
    pagado: Math.round(b.paid),
    ganancia: Math.round(b.profit),
  }));

  // Datos diarios por mes para el modo Mensual del gráfico.
  function buildDailyForMonth(monthKey: string): ChartPoint[] {
    const [y, m] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const todayDay =
      now.getUTCFullYear() === y && now.getUTCMonth() + 1 === m
        ? now.getUTCDate()
        : daysInMonth;

    const dailyMap = new Map<number, { cobrado: number; pagado: number; ganancia: number }>();
    for (let d = 1; d <= todayDay; d++) {
      dailyMap.set(d, { cobrado: 0, pagado: 0, ganancia: 0 });
    }

    for (const pay of payments) {
      if (!pay.paid_at.startsWith(monthKey)) continue;
      const d = parseInt(pay.paid_at.slice(8, 10), 10);
      const bucket = dailyMap.get(d);
      if (bucket) { bucket.cobrado += pay.amount; bucket.ganancia += pay.amount; }
    }

    for (const p of projects) {
      if (p.parent_id) continue;
      const projectDate = p.finalized_at ?? p.created_at;
      if (!projectDate || !projectDate.startsWith(monthKey)) continue;
      const d = parseInt(projectDate.slice(8, 10), 10);
      const bucket = dailyMap.get(d);
      if (!bucket) continue;

      const isMensual = p.client?.payment_type === "mensual";

      if (!isMensual && p.cobrado === "si") {
        const price = computePrice(p);
        if (price != null) { bucket.cobrado += price; bucket.ganancia += price; }
        const cost = computeCost(p);
        if (cost != null) bucket.ganancia -= cost;
      }
      if (p.pagado === "pago_total") {
        const cost = computeCost(p);
        if (cost != null) bucket.pagado += cost;
      }
    }

    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, vals]) => ({
        label: String(day),
        cobrado: Math.round(vals.cobrado),
        pagado: Math.round(vals.pagado),
        ganancia: Math.round(vals.ganancia),
      }));
  }

  const dailyByMonth: Record<string, ChartPoint[]> = Object.fromEntries(
    sortedBuckets.map((b) => [b.key, buildDailyForMonth(b.key)])
  );

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

  // ── Costos por cliente: costo de editores en proyectos pagados ──
  const costByClientMap = new Map<string, { color: string; total: number }>();
  for (const p of projects) {
    if (p.parent_id) continue;
    if (p.pagado !== "pago_total") continue;
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
    <div className="flex flex-col gap-4">
      {/* Fila 1: 4 stat cards grandes con blob de color */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FinanzaStatCard
          label="Total"
          value={formatPrice(totalCollected)}
          blobColor="#37ACFF80"
        />
        <FinanzaStatCard
          label="Costos"
          value={formatPrice(totalPaid)}
          blobColor="#FF373780"
        />
        <FinanzaStatCard
          label="Ganancias"
          value={formatPrice(totalProfit)}
          blobColor={totalProfit < 0 ? "#FF373780" : "#37FF6280"}
        />
        <FinanzaStatCard
          label="Servicios / mes"
          value={formatPrice(servicesMonthlyTotal)}
        />
      </section>

      {/* Fila 2: 2 stat cards medianas */}
      <section className="grid grid-cols-2 gap-3">
        <FinanzaStatCard
          label="Por cobrar"
          value={formatPrice(totalPendingCollect)}
          blobColor="#37ACFF50"
          small
        />
        <FinanzaStatCard
          label="Por pagar"
          value={formatPrice(totalPendingPay)}
          blobColor="#FF373750"
          small
        />
      </section>

      {/* Fila 3: Line chart con toggle Histórico | Mensual */}
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <FinanzasLineChart monthly={monthlyChartData} dailyByMonth={dailyByMonth} />
      </div>

      {/* Fila 4: Tres donuts por cliente */}
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
    <main className="flex w-full flex-col gap-6 p-4 md:p-5">
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
          cobros_pendientes: <PendingCobrosSection items={projectItems} />,
          servicios: (
            <FixedServicesSection
              services={fixedServices}
              monthlyApplication={monthlyApplication}
              currentMonthKey={currentMonthKey}
            />
          ),
        }}
      />
    </main>
  );
}

function FinanzaStatCard({
  label,
  value,
  blobColor,
  small = false,
}: {
  label: string;
  value: string;
  blobColor?: string;
  small?: boolean;
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
      style={{ padding: small ? "14px 18px" : "20px" }}>
      {blobColor && (
        <div
          className="pointer-events-none absolute"
          style={{
            width: small ? 140 : 200,
            height: small ? 140 : 200,
            borderRadius: "50%",
            background: blobColor,
            filter: "blur(50px)",
            bottom: small ? -55 : -65,
            right: small ? -45 : -55,
          }}
        />
      )}
      <div className="relative z-10 mt-auto flex flex-col gap-1">
        <span className="text-xs font-light uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className={`font-bold tabular-nums ${small ? "text-2xl" : "text-3xl"}`}>
          {value}
        </span>
      </div>
    </div>
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

// ── Cobros pendientes ──────────────────────────────────────────────────────────

function PendingCobrosSection({ items }: { items: ProjectSettleItem[] }) {
  // Solo cobros no saldados, ordenados de más viejo a más nuevo.
  const pending = [...items]
    .filter((i) => i.field === "cobrado" && !i.settled)
    .sort((a, b) => {
      if (a.yearMonth !== b.yearMonth)
        return a.yearMonth.localeCompare(b.yearMonth); // más viejo primero
      return (b.remaining ?? 0) - (a.remaining ?? 0); // más monto primero en el mismo mes
    });

  const total = pending.reduce((s, i) => s + (i.remaining ?? 0), 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Cobros pendientes
          </h2>
          {pending.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {pending.length} proyecto{pending.length === 1 ? "" : "s"} ·{" "}
              <span className="text-amber-500 tabular-nums">
                {formatPrice(total)} por cobrar
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
          <span className="text-2xl">✓</span>
          <p className="text-sm italic">
            ¡Todo cobrado! No hay cobros pendientes.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border/40 p-0">
            {pending.map((it) => (
              <SettleRow key={`${it.projectId}-cobrado`} item={it} />
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

