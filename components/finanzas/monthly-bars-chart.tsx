"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MonthlyDatum = {
  month: string;
  cobrado: number;
  porCobrar: number;
  pagado: number;
  ganancia: number;
};

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
              className="size-2 rounded-sm"
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

export function MonthlyBarsChart({ data }: { data: MonthlyDatum[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Sin meses con actividad para graficar.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
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
          cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
          content={<TooltipContent />}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="square"
        />
        <Bar
          dataKey="cobrado"
          name="Cobrado"
          fill="#22c55e"
          radius={[3, 3, 0, 0]}
        />
        <Bar
          dataKey="porCobrar"
          name="Por cobrar"
          fill="#86efac"
          radius={[3, 3, 0, 0]}
        />
        <Bar
          dataKey="pagado"
          name="Pagado"
          fill="#f59e0b"
          radius={[3, 3, 0, 0]}
        />
        <Bar
          dataKey="ganancia"
          name="Ganancia"
          fill="#3b82f6"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
