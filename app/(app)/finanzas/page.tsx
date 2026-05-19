import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchProjects } from "@/lib/projects/queries";
import {
  fetchFixedServices,
  fetchSettlements,
  settlementKey,
} from "@/lib/finanzas/queries";
import { FixedServicesSection } from "@/components/finanzas/fixed-services-section";
import {
  computeCost,
  computePrice,
  computeProfit,
  formatDuration,
  formatPrice,
} from "@/lib/projects/format";
import { monthToneFromKey } from "@/lib/projects/month-colors";
import type { ProjectWithRelations } from "@/lib/projects/types";
import { MonthlySettleButton } from "@/components/finanzas/monthly-settle-button";
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
  mensualCount: number;
};

type MensualItem = {
  yearMonth: string;
  monthLabel: string;
  partyType: "client_cobro" | "editor_pago";
  partyId: string;
  partyName: string;
  partyColor?: string;
  amount: number;
  settled: boolean;
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
  mensualItems: MensualItem[];
  projectItems: ProjectSettleItem[];
};

function build(
  projects: ProjectWithRelations[],
  settledKeys: Set<string>
): BuildResult {
  const byKey = new Map<string, MonthBucket>();
  const seenMonthlyClients = new Map<string, Set<string>>();
  const mensualItems: MensualItem[] = [];
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
        mensualCount: 0,
      });
      seenMonthlyClients.set(key, new Set());
    }
    return byKey.get(key)!;
  }

  for (const p of projects) {
    // Un proyecto entra a Finanzas sólo cuando está finalizado, y lo hace en
    // el mes en que se finalizó (finalized_at).
    if (!p.finalized) continue;
    const monthIso = p.finalized_at ?? p.created_at;
    const key = monthKey(monthIso);
    const bucket = ensureBucket(key, monthIso);
    bucket.projects.push(p);

    const client = p.client;
    const isClientMensual = client?.payment_type === "mensual";
    if (isClientMensual) bucket.mensualCount += 1;

    // ============ Cliente mensual (cobramos monthly_fee una vez/mes) ============
    if (
      client?.payment_type === "mensual" &&
      client.monthly_fee != null &&
      !seenMonthlyClients.get(key)!.has(client.id)
    ) {
      seenMonthlyClients.get(key)!.add(client.id);
      const fee = Number(client.monthly_fee);
      const settled = settledKeys.has(
        settlementKey(key, "client_cobro", client.id)
      );
      if (settled) {
        bucket.collected += fee;
      } else {
        bucket.pendingCollect += fee;
      }
      mensualItems.push({
        yearMonth: key,
        monthLabel: bucket.label,
        partyType: "client_cobro",
        partyId: client.id,
        partyName: client.name,
        partyColor: client.color,
        amount: fee,
        settled,
      });
    }

    // ============ Cobros por proyecto (por_proyecto + por_rate) ============
    // Incluimos cualquier proyecto que NO sea mensual (incluso sin cliente
    // linkeado), aunque el monto todavía no sea calculable.
    if (!client || client.payment_type !== "mensual") {
      const price = computePrice(p);
      const cobradoSettled = p.cobrado === "si";
      if (price != null) {
        if (cobradoSettled) {
          bucket.collected += price;
        } else {
          bucket.pendingCollect += price;
        }
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

    // ============ Pagos por proyecto (todos los editores aportan al costo) ============
    const hasEditor = p.editors.some((e) => e.editor != null);
    if (hasEditor) {
      const cost = computeCost(p);
      const pagadoSettled = p.pagado === "pago_total";
      if (cost != null) {
        if (pagadoSettled) {
          bucket.paid += cost;
        } else {
          bucket.pendingPay += cost;
        }
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

    // ============ Ganancia ============
    const profit = computeProfit(p);
    if (profit != null) {
      bucket.profit += profit;
    }
  }

  const buckets = Array.from(byKey.values()).sort((a, b) =>
    b.key.localeCompare(a.key)
  );

  // Pendientes primero (settled=false), después saldados. Dentro de cada
  // grupo, por mes desc y luego por monto desc.
  function cmp(
    a: { settled: boolean; yearMonth: string; amount: number | null },
    b: { settled: boolean; yearMonth: string; amount: number | null }
  ): number {
    if (a.settled !== b.settled) return a.settled ? 1 : -1;
    if (a.yearMonth !== b.yearMonth) return b.yearMonth.localeCompare(a.yearMonth);
    return (b.amount ?? 0) - (a.amount ?? 0);
  }
  mensualItems.sort(cmp);
  projectItems.sort(cmp);

  return { buckets, mensualItems, projectItems };
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
  const [projects, settledKeys, fixedServices] = await Promise.all([
    fetchProjects(),
    fetchSettlements(),
    fetchFixedServices(),
  ]);
  const { buckets, mensualItems, projectItems } = build(
    projects,
    settledKeys
  );

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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">
          {buckets.length} mes{buckets.length === 1 ? "" : "es"} con actividad
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
        <TotalCard label="Pagado" value={formatPrice(totalPaid)} tone="neutral" />
        <TotalCard
          label="Por pagar"
          value={formatPrice(totalPendingPay)}
          tone="warning"
        />
        <TotalCard
          label="Ganancia"
          value={formatPrice(totalProfit)}
          tone="positive"
        />
      </section>

      <MensualesSection items={mensualItems} />
      <ProjectsSection items={projectItems} />
      <FixedServicesSection services={fixedServices} />

      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Por mes
        </h2>
        {buckets.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            No hay proyectos cargados todavía.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {buckets.map((b) => (
              <MonthCard key={b.key} bucket={b} />
            ))}
          </div>
        )}
      </section>
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

function MensualesSection({ items }: { items: MensualItem[] }) {
  const pendientes = items.filter((i) => !i.settled).length;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Mensuales
        </h2>
        <span className="text-xs text-muted-foreground">
          {pendientes} pendiente{pendientes === 1 ? "" : "s"} · {items.length}{" "}
          total
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          No hay clientes ni editores mensuales activos.
        </p>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border/40 p-0">
            {items.map((it) => (
              <div
                key={`${it.yearMonth}-${it.partyType}-${it.partyId}`}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                  it.settled ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {it.partyColor ? (
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: it.partyColor }}
                    />
                  ) : null}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{it.partyName}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {it.monthLabel} ·{" "}
                      {it.partyType === "client_cobro"
                        ? "cobrar (cliente)"
                        : "pagar (editor)"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPrice(it.amount)}
                  </span>
                  <MonthlySettleButton
                    yearMonth={it.yearMonth}
                    partyType={it.partyType}
                    partyId={it.partyId}
                    settled={it.settled}
                    description={`${it.partyName} — ${it.monthLabel}`}
                  />
                </div>
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
          subtitle="editores (rate × duración)"
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
            No hay proyectos con monto computable.
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
          {bucket.projects.length} proyecto
          {bucket.projects.length === 1 ? "" : "s"}
          {bucket.mensualCount > 0
            ? ` · ${bucket.mensualCount} mensual${bucket.mensualCount === 1 ? "" : "es"}`
            : ""}
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
              {bucket.projects.map((p) => {
                const price = computePrice(p);
                const profit = computeProfit(p);
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 text-xs"
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
                    <div className="flex shrink-0 items-center gap-3 tabular-nums">
                      <span className="text-muted-foreground">
                        {formatDuration(p.duration_minutes)}
                      </span>
                      <span>{price != null ? formatPrice(price) : "—"}</span>
                      <span
                        className={
                          profit != null && profit < 0
                            ? "text-destructive"
                            : "text-emerald-500"
                        }
                      >
                        {profit != null ? formatPrice(profit) : "—"}
                      </span>
                    </div>
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
