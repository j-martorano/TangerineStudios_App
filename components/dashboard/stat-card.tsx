import Link from "next/link";
import { ArrowRightIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type StatCardItem = {
  /** Texto principal (ej. "P-001 Reel demo Acme"). */
  primary: string;
  /** Texto secundario discreto (ej. "Acme · $450"). */
  secondary?: string;
  /** Color para el dot a la izquierda (opcional). */
  color?: string | null;
};

type Delta = {
  /** Valor numérico de comparación (positivo = aumento). */
  raw: number;
  /** Texto a mostrar (ej. "+$200" o "+15%"). */
  text: string;
};

type Props = {
  label: string;
  value: string;
  hint?: string;
  delta?: Delta;
  items?: StatCardItem[];
  /** Máximo de items a mostrar antes de "+ N más". */
  maxItems?: number;
  href?: string;
  hrefLabel?: string;
  highlight?: boolean;
};

/**
 * Card del dashboard con un valor principal, un delta vs período anterior y
 * una lista breve embebida de items relacionados (proyectos, clientes, etc.).
 * Apunta a una página de detalle con el link al pie.
 */
export function StatCard({
  label,
  value,
  hint,
  delta,
  items,
  maxItems = 3,
  href,
  hrefLabel = "Ver todos",
  highlight,
}: Props) {
  const visibleItems = items?.slice(0, maxItems) ?? [];
  const more = (items?.length ?? 0) - visibleItems.length;

  return (
    <Card
      size="sm"
      className={`flex h-full flex-col ${highlight ? "ring-1 ring-primary/50" : ""}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        {delta ? <DeltaBadge delta={delta} /> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span
            className={`text-2xl font-semibold tabular-nums ${
              highlight ? "text-primary" : ""
            }`}
          >
            {value}
          </span>
          {hint ? (
            <span className="text-xs text-muted-foreground truncate">
              {hint}
            </span>
          ) : null}
        </div>

        {visibleItems.length > 0 ? (
          <ul className="flex flex-col gap-1 border-t border-border/40 pt-2">
            {visibleItems.map((it, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                {it.color ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: it.color }}
                  />
                ) : null}
                <span className="truncate text-foreground">{it.primary}</span>
                {it.secondary ? (
                  <span className="ml-auto shrink-0 tabular-nums">
                    {it.secondary}
                  </span>
                ) : null}
              </li>
            ))}
            {more > 0 ? (
              <li className="text-xs italic text-muted-foreground">
                + {more} más
              </li>
            ) : null}
          </ul>
        ) : null}

        {href ? (
          <Link
            href={href}
            className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {hrefLabel}
            <ArrowRightIcon className="size-3" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DeltaBadge({ delta }: { delta: Delta }) {
  const positive = delta.raw > 0;
  const negative = delta.raw < 0;
  const Icon = positive ? TrendingUpIcon : negative ? TrendingDownIcon : null;
  const color = positive
    ? "text-emerald-500"
    : negative
      ? "text-destructive"
      : "text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium tabular-nums ${color}`}
      title="vs mes anterior"
    >
      {Icon ? <Icon className="size-3" /> : null}
      {delta.text}
    </span>
  );
}
