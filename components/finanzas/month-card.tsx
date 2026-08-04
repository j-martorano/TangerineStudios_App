"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { monthToneFromKey } from "@/lib/projects/month-colors";
import {
  computeCost,
  computePrice,
  computeProfit,
  formatPrice,
} from "@/lib/projects/format";
import type {
  CobradoStatus,
  PagadoStatus,
  ProjectWithRelations,
} from "@/lib/projects/types";

type Props = {
  monthKey: string;
  label: string;
  collected: number;
  pendingCollect: number;
  paid: number;
  pendingPay: number;
  profit: number;
  servicesCost: number;
  projects: ProjectWithRelations[];
  defaultOpen?: boolean;
};

function cobradoColor(status: CobradoStatus): string {
  if (status === "si") return "text-emerald-500";
  if (status === "parcial") return "text-amber-500";
  return "text-muted-foreground";
}

function pagadoColor(status: PagadoStatus): string {
  if (status === "pago_total") return "text-emerald-500";
  if (status === "parcial") return "text-amber-500";
  return "text-muted-foreground";
}

/**
 * Card de un mes en Finanzas. Por default está cerrada: solo el header con
 * Cobrado / Pagado / Ganancia en una línea. Al click se despliega el detalle
 * (con los totales por sección y el recap de videos finalizados).
 */
export function MonthCard({
  monthKey,
  label,
  collected,
  pendingCollect,
  paid,
  pendingPay,
  profit,
  servicesCost,
  projects,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = monthToneFromKey(monthKey);
  const profitClass = profit < 0 ? "text-destructive" : "text-emerald-500";

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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full cursor-pointer text-left"
      >
        <CardHeader
          className={`flex flex-row flex-wrap items-center justify-between gap-3 ${
            open ? "border-b pb-3" : "pb-3"
          }`}
        >
          <div className="flex items-center gap-2">
            <ChevronDownIcon
              className={`size-4 text-muted-foreground transition-transform duration-200 ${
                open ? "" : "-rotate-90"
              }`}
            />
            <CardTitle className="uppercase tracking-wide">{label}</CardTitle>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
            <Inline label="Cobrado" value={formatPrice(collected)} valueClass="text-sky-400" />
            <Inline label="Pagado" value={formatPrice(paid)} valueClass="text-red-400" />
            <Inline
              label="Ganancia"
              value={formatPrice(profit)}
              valueClass={profitClass}
              bold
            />
            <span className="text-[10px] text-muted-foreground">
              {projects.length} video{projects.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>
      </button>

      {open ? (
        <CardContent className="animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <MonthRow
              label="Cobrado"
              primary={formatPrice(collected)}
              secondaryLabel="Por cobrar"
              secondary={formatPrice(pendingCollect)}
              tone="cobrado"
            />
            <MonthRow
              label="Pagado"
              primary={formatPrice(paid)}
              secondaryLabel="Por pagar"
              secondary={formatPrice(pendingPay)}
              tone="pagado"
            />
            {servicesCost > 0 ? (
              <MonthRow
                label="Servicios fijos"
                primary={`− ${formatPrice(servicesCost)}`}
              />
            ) : null}
            <MonthRow
              label="Ganancia"
              primary={formatPrice(profit)}
              tone={profit < 0 ? "negative" : "positive"}
            />
          </div>

          {projects.length > 0 ? (
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
                {projects.map((p) => {
                  const isMensual = p.client?.payment_type === "mensual";
                  const price = isMensual ? null : computePrice(p);
                  const cost = computeCost(p);
                  const profitP = computeProfit(p);
                  const cobradoStr = isMensual
                    ? "RETAINER"
                    : price != null
                      ? formatPrice(price)
                      : "—";
                  const pagadoStr = cost != null ? formatPrice(cost) : "—";
                  const profitStr =
                    profitP != null ? formatPrice(profitP) : "—";
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
                          profitP == null
                            ? "text-muted-foreground"
                            : profitP < 0
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
      ) : null}
    </Card>
  );
}

function Inline({
  label,
  value,
  valueClass,
  bold,
}: {
  label: string;
  value: string;
  valueClass?: string;
  bold?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? "font-semibold" : "font-medium"} ${
          valueClass ?? ""
        }`}
      >
        {value}
      </span>
    </span>
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
  tone?: "positive" | "negative" | "cobrado" | "pagado";
}) {
  const primaryClass =
    tone === "positive" ? "text-emerald-500"
    : tone === "negative" ? "text-destructive"
    : tone === "cobrado" ? "text-sky-400"
    : tone === "pagado" ? "text-red-400"
    : "text-foreground";
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
