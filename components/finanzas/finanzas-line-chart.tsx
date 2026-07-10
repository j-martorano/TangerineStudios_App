"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyDatum } from "./monthly-bars-chart";

type ViewMode = "historico" | "mensual";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

function fmtAxis(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v}`;
}

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{label}</div>
      <div className="flex flex-col gap-0.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-medium tabular-nums">
              {USD.format(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeCumulative(data: MonthlyDatum[]): MonthlyDatum[] {
  let cumCobrado = 0;
  let cumPagado = 0;
  let cumGanancia = 0;
  let cumPorCobrar = 0;
  return data.map((d) => {
    cumCobrado += d.cobrado;
    cumPagado += d.pagado;
    cumGanancia += d.ganancia;
    cumPorCobrar += d.porCobrar;
    return {
      month: d.month,
      cobrado: cumCobrado,
      pagado: cumPagado,
      ganancia: cumGanancia,
      porCobrar: cumPorCobrar,
    };
  });
}

export function FinanzasLineChart({ data }: { data: MonthlyDatum[] }) {
  const [mode, setMode] = useState<ViewMode>("historico");

  if (data.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Sin meses con actividad para graficar.
      </p>
    );
  }

  const chartData =
    mode === "historico" ? computeCumulative(data) : data.slice(-12);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
        <button
          type="button"
          onClick={() => setMode("historico")}
          className={`transition-colors ${
            mode === "historico"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground/70"
          }`}
        >
          Histórico
        </button>
        <span className="text-muted-foreground/30">|</span>
        <button
          type="button"
          onClick={() => setMode("mensual")}
          className={`transition-colors ${
            mode === "mensual"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground/70"
          }`}
        >
          Mensual
        </button>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-muted-foreground/20"
          />
          <XAxis
            dataKey="month"
            stroke="currentColor"
            className="text-muted-foreground"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            stroke="currentColor"
            className="text-muted-foreground"
            tick={{ fontSize: 11 }}
            tickFormatter={fmtAxis}
          />
          <Tooltip
            cursor={{ stroke: "currentColor", strokeOpacity: 0.15 }}
            content={<TooltipContent />}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            iconType="circle"
          />
          <Line
            dataKey="ganancia"
            name="Ganancia"
            stroke="#37FF62"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            type="monotone"
          />
          <Line
            dataKey="pagado"
            name="Pagos"
            stroke="#FF3737"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            type="monotone"
          />
          <Line
            dataKey="cobrado"
            name="Total"
            stroke="#37ACFF"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
