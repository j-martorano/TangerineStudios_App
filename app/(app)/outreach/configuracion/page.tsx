import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { DefaultTemplateForm } from "@/components/outreach/config/default-template-form";
import { PlatformsManager } from "@/components/outreach/config/platforms-manager";
import { ResourcesManager } from "@/components/outreach/config/resources-manager";
import { TagsHelp } from "@/components/outreach/config/tags-help";
import { requireTab } from "@/lib/auth/permissions";
import { fetchOutreachConfig } from "@/lib/outreach/queries";

export default async function OutreachConfigPage() {
  await requireTab("outreach");
  const config = await fetchOutreachConfig();

  return (
    <main className="flex w-full max-w-5xl flex-col gap-10 p-6 md:p-8">
      <header>
        <Link
          href="/outreach"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Outreach
        </Link>
        <h1 className="mt-2 text-5xl font-bold uppercase tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm font-light text-muted-foreground">
          Plantillas, plataformas, páginas y samples del constructor de mensajes.
        </p>
      </header>

      <Section
        title="Mensaje default"
        hint="Se usa cuando la plataforma elegida no tiene plantilla propia."
      >
        <TagsHelp resources={config.resources} />
        <DefaultTemplateForm template={config.defaultTemplate} />
      </Section>

      <Section
        title="Plataformas"
        hint="Dónde se manda el mensaje. Cada una puede tener su propia plantilla."
      >
        <PlatformsManager platforms={config.platforms} />
      </Section>

      <Section
        title="Páginas"
        hint="Web, portfolio y demás links fijos. Van en {PAGINAS} o con su etiqueta puntual."
      >
        <ResourcesManager kind="pagina" resources={config.resources} />
      </Section>

      <Section
        title="Samples"
        hint="Ejemplos de edición por tipo de video. Van en {SAMPLES} o con su etiqueta puntual."
      >
        <ResourcesManager kind="sample" resources={config.resources} />
      </Section>
    </main>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-bold uppercase tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}
