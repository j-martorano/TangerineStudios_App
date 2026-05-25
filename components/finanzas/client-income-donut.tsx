"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export type ClientIncomeDatum = {
  name: string;
  color: string;
  value: number;
};

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

const RED = "#ef4444";

function TooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { name: string; originalValue: number; fill: string } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: item.payload.fill }}
        />
        <span>{item.payload.name}</span>
        <span className="ml-3 font-medium tabular-nums">
          {USD.format(item.payload.originalValue)}
        </span>
      </div>
    </div>
  );
}

/**
 * Donut de distribución por cliente.
 * - `allowNegative`: si true, muestra valores negativos (slice rojo + texto rojo).
 *   Los valores negativos se dimensionan por valor absoluto en el gráfico pero
 *   el tooltip y la leyenda muestran el valor real.
 */
export function ClientIncomeDonut({
  data,
  allowNegative = false,
  emptyMessage = "Sin datos cargados todavía.",
}: {
  data: ClientIncomeDatum[];
  allowNegative?: boolean;
  emptyMessage?: string;
}) {
  const filteredData = allowNegative
    ? data.filter((d) => d.value !== 0)
    : data.filter((d) => d.value > 0);

  if (filteredData.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">{emptyMessage}</p>
    );
  }

  // Recharts no acepta valores negativos en Pie — usamos el valor absoluto para
  // el tamaño del slice; los negativos se colorean en rojo.
  const chartData = filteredData.map((d) => ({
    name: d.name,
    absValue: Math.abs(d.value),
    originalValue: d.value,
    color: d.color,
    fill: d.value < 0 ? RED : d.color,
  }));

  const total = filteredData.reduce((s, d) => s + Math.abs(d.value), 0);

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="absValue"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            stroke="none"
          >
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip content={<TooltipContent />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-1 text-xs">
        {filteredData.map((d) => {
          const pct =
            total > 0 ? Math.round((Math.abs(d.value) / total) * 100) : 0;
          const isNeg = d.value < 0;
          return (
            <li key={d.name} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: isNeg ? RED : d.color }}
              />
              <span className={`truncate ${isNeg ? "text-destructive" : ""}`}>
                {d.name}
              </span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {pct}%
              </span>
              <span
                className={`w-20 text-right font-medium tabular-nums ${
                  isNeg ? "text-destructive" : ""
                }`}
              >
                {USD.format(d.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
