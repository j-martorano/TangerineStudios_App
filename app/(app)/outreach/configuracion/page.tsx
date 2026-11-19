import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { PlatformsManager } from "@/components/outreach/config/platforms-manager";
import { ResourcesManager } from "@/components/outreach/config/resources-manager";
import { TagsHelp } from "@/components/outreach/config/tags-help";
import { TemplatesManager } from "@/components/outreach/config/templates-manager";
import { requireTab } from "@/lib/auth/permissions";
import { fetchOutreachConfig } from "@/lib/outreach/queries";

export default async function OutreachConfigPage() {
  await requireTab("outreach");
  const config = await fetchOutreachConfig();

  return (
    <main className="flex w-full flex-col gap-10 p-6 md:p-8">
      <header>
        <Link
          href="/outreach"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Outreach
        </Link>
        <h1 className="mt-2 text-5xl font-bold uppercase tracking-tight">Configuración</h1>
      </header>

      <Section title="Mensajes">
        <TagsHelp resources={config.resources} />
        <TemplatesManager
          templates={config.templates}
          defaultTemplateId={config.defaultTemplateId}
          platforms={config.platforms}
          resources={config.resources}
        />
      </Section>

      <Section title="Plataformas">
        <PlatformsManager
          platforms={config.platforms}
          templates={config.templates}
          defaultTemplateId={config.defaultTemplateId}
        />
      </Section>

      <Section title="Páginas">
        <ResourcesManager kind="pagina" resources={config.resources} />
      </Section>

      <Section title="Samples">
        <ResourcesManager kind="sample" resources={config.resources} />
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold uppercase tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
