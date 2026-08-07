import { previewBackfill } from "@/lib/projects/backfill";
import { BackfillPanel } from "./backfill-panel";

export default async function AdminPage() {
  const preview = await previewBackfill();

  return (
    <main className="flex w-full flex-col gap-6 p-6 md:p-8">
      <header>
        <h1 className="text-2xl font-bold uppercase tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Herramientas de mantenimiento. Acá no se modifica el orden del kanban.
        </p>
      </header>

      <BackfillPanel preview={preview} />
    </main>
  );
}
