import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchProjects } from "@/lib/projects/queries";
import {
  fetchClientPayments,
  fetchFixedServices,
} from "@/lib/finanzas/queries";
import { fetchUserPrefs } from "@/lib/settings/queries";
import { FixedServicesSection } from "@/components/finanzas/fixed-services-section";
import { FinanzasTabs } from "@/components/finanzas/finanzas-tabs";
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

export const dynamic = "force-dynamic";

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
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
  amount: number | null;
  settled: boolean;
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
  for (const p of projects) {
    if (!p.finalized) continue;
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
      const cobradoSettled = p.cobrado === "si";
      if (price != null) {
        if (cobradoSettled) bucket.collected += price;
        else bucket.pendingCollect += price;
      }
      projectItems.push({
        yearMonth: key,
        monthLabel: bucket.label,
        projectId: p.id,
        projectCode: p.project_code,
        projectTitle: p.title,
        clientName: client?.name ?? p.client_name ?? "Sin cliente",
        field: "cobrado",
        amount: price,
        settled: cobradoSettled,
      });
    }

    // Pagos por proyecto — todos los editores aportan al costo.
    const hasEditor = p.editors.some((e) => e.editor != null);
    if (hasEditor) {
      const cost = computeCost(p);
      const pagadoSettled = p.pagado === "pago_total";
      if (cost != null) {
        if (pagadoSettled) bucket.paid += cost;
        else bucket.pendingPay += cost;
      }
      projectItems.push({
        yearMonth: key,
        monthLabel: bucket.label,
        projectId: p.id,
        projectCode: p.project_code,
        projectTitle: p.title,
        clientName: client?.name ?? p.client_name ?? "—",
        field: "pagado",
        amount: cost,
        settled: pagadoSettled,
      });
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
    return (b.amount ?? 0) - (a.amount ?? 0);
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

export default async function FinanzasPage() {
  const [projects, payments, fixedServices, prefs] = await Promise.all([
    fetchProjects(),
    fetchClientPayments(),
    fetchFixedServices(),
    fetchUserPrefs(),
  ]);
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

  const resumenSection = (
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
        tone="positive"
      />
    </section>
  );

  const porMesSection =
    buckets.length === 0 ? (
      <p className="text-sm italic text-muted-foreground">
        No hay actividad cargada todavía.
      </p>
    ) : (
      <div className="flex flex-col gap-3">
        {buckets.map((b) => (
          <MonthCard key={b.key} bucket={b} />
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
        sections={{
          resumen: resumenSection,
          por_mes: porMesSection,
          pagos: <PagosSection items={paymentItems} />,
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
  tone: "positive" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-500"
      : tone === "warning"
        ? "text-amber-500"
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

function PagosSection({ items }: { items: PaymentItem[] }) {
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Pagos de clientes FLAT
        </h2>
        <span className="text-xs text-muted-foreground">
          {items.length} pago{items.length === 1 ? "" : "s"} ·{" "}
          {formatPrice(total)}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          No hay pagos de clientes mensuales registrados. Cargalos desde la
          ficha del cliente.
        </p>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border/40 p-0">
            {items.map((it, i) => (
              <div
                key={`${it.paidAt}-${it.clientName}-${i}`}
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
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
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
            <div
              key={`${it.projectId}-${it.field}`}
              className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                it.settled ? "opacity-60" : ""
              }`}
            >
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {it.projectCode}
                </span>
                <span className="truncate text-sm font-medium">
                  {it.projectTitle}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {it.clientName} · {it.monthLabel}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">
                  {formatPrice(it.amount)}
                </span>
                <ProjectSettleButton
                  projectId={it.projectId}
                  field={it.field}
                  settled={it.settled}
                  description={`${it.projectCode} (${it.field})`}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MonthCard({ bucket }: { bucket: MonthBucket }) {
  const tone = monthToneFromKey(bucket.key);
  return (
    <Card
      className="relative overflow-hidden"
      style={{ backgroundColor: tone.tint }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: tone.solid }}
      />
      <CardHeader className="flex flex-row items-baseline justify-between gap-2 border-b pb-3">
        <CardTitle className="uppercase tracking-wide">
          {bucket.label}
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {bucket.projects.length} video
          {bucket.projects.length === 1 ? "" : "s"} finalizado
          {bucket.projects.length === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <MonthRow
            label="Cobrado"
            primary={formatPrice(bucket.collected)}
            secondaryLabel="Por cobrar"
            secondary={formatPrice(bucket.pendingCollect)}
          />
          <MonthRow
            label="Pagado"
            primary={formatPrice(bucket.paid)}
            secondaryLabel="Por pagar"
            secondary={formatPrice(bucket.pendingPay)}
          />
          {bucket.servicesCost > 0 ? (
            <MonthRow
              label="Servicios fijos"
              primary={`− ${formatPrice(bucket.servicesCost)}`}
            />
          ) : null}
          <MonthRow
            label="Ganancia"
            primary={formatPrice(bucket.profit)}
            tone={bucket.profit < 0 ? undefined : "positive"}
          />
        </div>

        {bucket.projects.length > 0 ? (
          <div className="mt-4 border-t pt-3">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recap — videos finalizados
            </h4>
            <div className="flex flex-col divide-y divide-border/40">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Proyecto / cliente</span>
                <span className="text-right">Cobrado</span>
                <span className="text-right">Pagado</span>
                <span className="text-right">Ganancia</span>
              </div>
              {bucket.projects.map((p) => {
                const isMensual = p.client?.payment_type === "mensual";
                const price = isMensual ? null : computePrice(p);
                const cost = computeCost(p);
                const profit = computeProfit(p);
                const cobradoStr = isMensual
                  ? "FLAT"
                  : price != null
                    ? formatPrice(price)
                    : "—";
                const pagadoStr = cost != null ? formatPrice(cost) : "—";
                const profitStr =
                  profit != null ? formatPrice(profit) : "—";
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 py-1.5 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {p.project_code}
                      </span>
                      <span className="truncate font-medium">{p.title}</span>
                      <span className="truncate text-muted-foreground">
                        {p.client?.name ?? p.client_name ?? "Sin cliente"}
                      </span>
                    </div>
                    <span
                      className={`text-right tabular-nums ${cobradoColor(p.cobrado)}`}
                    >
                      {cobradoStr}
                    </span>
                    <span
                      className={`text-right tabular-nums ${pagadoColor(p.pagado)}`}
                    >
                      {pagadoStr}
                    </span>
                    <span
                      className={`text-right tabular-nums ${
                        profit == null
                          ? "text-muted-foreground"
                          : profit < 0
                            ? "text-destructive"
                            : "text-emerald-500"
                      }`}
                    >
                      {profitStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MonthRow({
  label,
  primary,
  secondaryLabel,
  secondary,
  tone,
}: {
  label: string;
  primary: string;
  secondaryLabel?: string;
  secondary?: string;
  tone?: "positive";
}) {
  const primaryClass =
    tone === "positive" ? "text-emerald-500" : "text-foreground";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${primaryClass}`}>
        {primary}
      </span>
      {secondaryLabel ? (
        <span className="text-xs text-muted-foreground tabular-nums">
          {secondaryLabel}: {secondary}
        </span>
      ) : null}
    </div>
  );
}
