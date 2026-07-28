"use client";

import { useEffect, useRef, useState } from "react";
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
import { ChevronDown } from "lucide-react";

export type ChartPoint = {
  label: string;
  cobrado: number;
  pagado: number;
  ganancia: number;
};

type ViewMode = "historico" | "mensual";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES_ES[m - 1]} ${y}`;
}

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

export function FinanzasLineChart({
  monthly,
  dailyByMonth,
}: {
  monthly: ChartPoint[];
  dailyByMonth: Record<string, ChartPoint[]>;
}) {
  const [mode, setMode] = useState<ViewMode>("historico");

  const monthKeys = Object.keys(dailyByMonth).sort();
  const latestMonth = monthKeys[monthKeys.length - 1] ?? "";
  const [selectedMonth, setSelectedMonth] = useState(latestMonth);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const data = mode === "historico" ? monthly : (dailyByMonth[selectedMonth] ?? []);

  if (monthly.length === 0 && Object.keys(dailyByMonth).length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Sin meses con actividad para graficar.
      </p>
    );
  }

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

        {mode === "mensual" && monthKeys.length > 0 && (
          <div ref={dropdownRef} className="relative ml-2">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-muted/70"
            >
              {formatMonthKey(selectedMonth)}
              <ChevronDown
                className={`size-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 max-h-52 min-w-[140px] overflow-y-auto rounded-md border border-border/50 bg-popover shadow-lg">
                {[...monthKeys].reverse().map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedMonth(key);
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-muted/60 ${
                      key === selectedMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {formatMonthKey(key)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-muted-foreground/20"
          />
          <XAxis
            dataKey="label"
            stroke="currentColor"
            className="text-muted-foreground"
            tick={{ fontSize: 11 }}
            interval={mode === "mensual" ? 4 : "preserveStartEnd"}
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
            dot={mode === "mensual" ? { r: 2 } : false}
            activeDot={{ r: 5 }}
            type="monotone"
          />
          <Line
            dataKey="pagado"
            name="Pagos"
            stroke="#FF3737"
            strokeWidth={2}
            dot={mode === "mensual" ? { r: 2 } : false}
            activeDot={{ r: 5 }}
            type="monotone"
          />
          <Line
            dataKey="cobrado"
            name="Total"
            stroke="#37ACFF"
            strokeWidth={2}
            dot={mode === "mensual" ? { r: 2 } : false}
            activeDot={{ r: 5 }}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
