"use client";

import {
  Cell,
  Legend,
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

function TooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: ClientIncomeDatum }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: item.payload.color }}
        />
        <span>{item.name}</span>
        <span className="ml-3 font-medium tabular-nums">
          {USD.format(item.value)}
        </span>
      </div>
    </div>
  );
}

export function ClientIncomeDonut({ data }: { data: ClientIncomeDatum[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Sin ingresos cargados todavía.
      </p>
    );
  }
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<TooltipContent />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-1 text-xs">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.name} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="truncate">{d.name}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {pct}%
              </span>
              <span className="w-20 text-right font-medium tabular-nums">
                {USD.format(d.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
