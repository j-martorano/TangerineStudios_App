import { previewBackfill } from "@/lib/projects/backfill";
import { BackfillPanel } from "./backfill-panel";
import { AmountsToggle } from "@/components/ui/amount";

export default async function AdminPage() {
  const preview = await previewBackfill();

  return (
    <main className="flex w-full flex-col gap-6 p-6 md:p-8">
      <header>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold uppercase tracking-tight">Admin</h1>
          <AmountsToggle />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Herramientas de mantenimiento. Acá no se modifica el orden del kanban.
        </p>
      </header>

      <BackfillPanel preview={preview} />
    </main>
  );
}
