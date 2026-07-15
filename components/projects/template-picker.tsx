"use client";

import { useEffect, useState, useTransition } from "react";
import { BookmarkPlusIcon, LayoutTemplateIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createTemplate,
  deleteTemplate,
  fetchTemplates,
} from "@/lib/projects/template-actions";
import { PHASE_LABEL } from "@/lib/projects/format";
import { PROJECT_TYPE_LABEL } from "@/lib/projects/types";
import type { ProjectTemplate } from "@/lib/projects/types";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type CurrentConfig = Omit<ProjectTemplate, "id" | "name" | "created_at">;

type Props = {
  /** Called when the user picks a template — apply its values to the form. */
  onApply: (t: ProjectTemplate) => void;
  /** Current form state — used when saving current config as a template. */
  currentConfig: CurrentConfig;
};

export function TemplatePicker({ onApply, currentConfig }: Props) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [pending, startTransition] = useTransition();

  function load() {
    fetchTemplates().then(setTemplates);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApply(id: string | null) {
    if (!id) return;
    const t = templates.find((t) => t.id === id);
    if (t) onApply(t);
  }

  function handleSave() {
    const name = saveName.trim();
    if (!name) return;
    startTransition(async () => {
      const r = await createTemplate({ name, ...currentConfig });
      if (r.ok) {
        toast.success(`Plantilla «${name}» guardada`);
        setSaveName("");
        setSaveOpen(false);
        load();
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleDelete(id: string, name: string) {
    startTransition(async () => {
      const r = await deleteTemplate(id);
      if (r.ok) {
        toast.success(`Plantilla «${name}» eliminada`);
        load();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* ── Selector ── */}
        <Select value="" onValueChange={handleApply}>
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue
              placeholder={
                templates.length === 0
                  ? "Sin plantillas"
                  : "Aplicar plantilla…"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span>{t.name}</span>
                {t.price != null ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {USD.format(t.price)}
                  </span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* ── Guardar config actual como plantilla ── */}
        <button
          type="button"
          onClick={() => {
            setSaveName("");
            setSaveOpen(true);
          }}
          title="Guardar configuración actual como plantilla"
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <BookmarkPlusIcon className="size-3.5" />
        </button>

        {/* ── Gestionar plantillas ── */}
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          title="Gestionar plantillas"
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LayoutTemplateIcon className="size-3.5" />
        </button>
      </div>

      {/* ── Dialog: guardar como plantilla ── */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar como plantilla</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <p className="text-sm text-muted-foreground">
              Se guarda la configuración actual: tipo, fase, precio, costo y
              duración.
            </p>
            <Input
              placeholder="Nombre de la plantilla"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={pending || !saveName.trim()}
            >
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: gestionar plantillas ── */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Plantillas de proyecto</DialogTitle>
          </DialogHeader>
          {templates.length === 0 ? (
            <p className="py-4 text-sm italic text-muted-foreground">
              Sin plantillas. Configurá un proyecto y usá el botón{" "}
              <BookmarkPlusIcon className="inline size-3.5" /> para guardar la
              configuración.
            </p>
          ) : (
            <div className="flex flex-col gap-2 py-1">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {PROJECT_TYPE_LABEL[t.project_type]}
                      {" · "}
                      {PHASE_LABEL[t.phase]}
                      {t.price != null ? ` · ${USD.format(t.price)}` : ""}
                      {t.cost != null ? ` · costo ${USD.format(t.cost)}` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id, t.name)}
                    disabled={pending}
                    aria-label="Eliminar plantilla"
                    className="shrink-0 text-muted-foreground/50 transition-colors hover:text-red-500 disabled:opacity-40"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
