import Link from "next/link";

import { DataSearch } from "@/components/data-search";
import { OutreachComposer } from "@/components/outreach/composer";
import { OutreachTable } from "@/components/outreach/messages-table";
import { todayAR } from "@/lib/argentina-date";
import { requireTab } from "@/lib/auth/permissions";
import { geminiConfigured } from "@/lib/outreach/gemini";
import { fetchOutreachConfig, fetchOutreachMessages } from "@/lib/outreach/queries";

type SearchParams = Promise<{ q?: string; year?: string }>;

export default async function OutreachPage({ searchParams }: { searchParams: SearchParams }) {
  await requireTab("outreach");
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() || undefined;

  const [config, allMessages] = await Promise.all([fetchOutreachConfig(), fetchOutreachMessages()]);

  const messages = query
    ? allMessages.filter((m) =>
        [m.clientName, m.platformName, m.message, m.notes ?? "", m.postUrl ?? ""]
          .join("\n")
          .toLowerCase()
          .includes(query)
      )
    : allMessages;

  const years = Array.from(new Set(messages.map((m) => Number(m.sentAt.slice(0, 4))))).sort(
    (a, b) => b - a
  );
  const currentYear = Number(todayAR().slice(0, 4));
  const requestedYear = Number(params.year);
  const selectedYear = years.includes(requestedYear)
    ? requestedYear
    : years.includes(currentYear)
      ? currentYear
      : (years[0] ?? currentYear);
  const yearMessages = messages.filter((m) => Number(m.sentAt.slice(0, 4)) === selectedYear);

  function yearHref(year: number): string {
    const sp = new URLSearchParams();
    sp.set("year", String(year));
    if (query) sp.set("q", params.q!.trim());
    return `/outreach?${sp.toString()}`;
  }

  return (
    <main className="flex w-full flex-col gap-6 p-6 md:p-8">
      <header>
        <h1 className="text-5xl font-bold uppercase tracking-tight">Outreach</h1>
        <p className="mt-1 text-sm font-light text-muted-foreground">
          {allMessages.length} mensaje{allMessages.length === 1 ? "" : "s"} registrado
          {allMessages.length === 1 ? "" : "s"}
        </p>
      </header>

      <OutreachComposer config={config} aiConfigured={geminiConfigured()} />

      <hr className="border-border" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DataSearch placeholder="Buscar por cliente, plataforma o texto…" />
      </div>

      {years.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1 border-b">
          {years.map((year) => {
            const active = year === selectedYear;
            return (
              <Link
                key={year}
                href={yearHref(year)}
                className={`-mb-px rounded-t-lg border border-b-0 px-4 py-1.5 text-sm font-medium tabular-nums transition-colors ${
                  active
                    ? "border-border bg-card text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                {year}
              </Link>
            );
          })}
        </div>
      ) : null}

      <OutreachTable messages={yearMessages} platforms={config.platforms} resources={config.resources} />
    </main>
  );
}
