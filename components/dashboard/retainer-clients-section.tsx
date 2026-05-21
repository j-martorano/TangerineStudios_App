import { Card, CardContent } from "@/components/ui/card";

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("es-AR", {
  numeric: "auto",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export type RetainerClientSummary = {
  id: string;
  name: string;
  color: string;
  minute_balance: number | null;
  lastPaymentAt: string | null;
};

function fmtMin(n: number): string {
  const rounded = Number.isInteger(n) ? n : Number(n.toFixed(1));
  return `${rounded} min`;
}

/** "hace 5 días" / "hace 1 mes" / ... según la diferencia con hoy. */
function relativeDate(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = then.getTime() - now.getTime();
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (Math.abs(days) < 30) return RELATIVE_FORMATTER.format(days, "day");
  const months = Math.round(days / 30);
  return RELATIVE_FORMATTER.format(months, "month");
}

export function RetainerClientsSection({
  clients,
}: {
  clients: RetainerClientSummary[];
}) {
  if (clients.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Clientes retainer
        </h2>
        <p className="text-sm italic text-muted-foreground">
          No hay clientes retainer cargados.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Clientes retainer
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((c) => {
          const balance = c.minute_balance ?? 0;
          const negative = balance < 0;
          const low = balance >= 0 && balance < 10;
          const balanceClass = negative
            ? "text-destructive"
            : low
              ? "text-amber-500"
              : "text-emerald-500";
          return (
            <Card
              key={c.id}
              size="sm"
              style={{ backgroundColor: `${c.color}1f` }}
            >
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-sm font-medium truncate">
                    {c.name}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`text-lg font-semibold tabular-nums ${balanceClass}`}
                  >
                    {fmtMin(balance)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Saldo
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {c.lastPaymentAt ? (
                    <>
                      Último pago:{" "}
                      <span className="text-foreground">
                        {DATE_FORMATTER.format(new Date(c.lastPaymentAt))}
                      </span>{" "}
                      ({relativeDate(c.lastPaymentAt)})
                    </>
                  ) : (
                    "Sin pagos registrados todavía"
                  )}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
