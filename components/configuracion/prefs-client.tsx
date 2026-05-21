"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  CLIENTS_COLUMNS,
  CLIENTS_COLUMN_LABEL,
  EDITORS_COLUMNS,
  EDITORS_COLUMN_LABEL,
  FINANZAS_TABS,
  FINANZAS_TAB_LABEL,
  PROJECTS_COLUMNS,
  PROJECTS_COLUMN_LABEL,
  type ClientsColumnId,
  type EditorsColumnId,
  type FinanzasTabId,
  type ProjectsColumnId,
  type UserPrefs,
} from "@/lib/settings/types";
import { updateUserPrefs } from "@/lib/settings/actions";

type Props = {
  initialPrefs: UserPrefs;
};

export function PrefsClient({ initialPrefs }: Props) {
  const [prefs, setPrefs] = useState<UserPrefs>(initialPrefs);
  const [, startTransition] = useTransition();

  function save(next: UserPrefs) {
    setPrefs(next);
    startTransition(async () => {
      const result = await updateUserPrefs(next);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Columnas visibles"
          hint="Marcá qué columnas mostrar en cada tabla. Las que destildés desaparecen, pero podés volver a activarlas cuando quieras."
        />
        <ColumnToggles<ProjectsColumnId>
          title="Proyectos"
          options={PROJECTS_COLUMNS.map((id) => ({
            id,
            label: PROJECTS_COLUMN_LABEL[id],
          }))}
          value={prefs.columns.projects}
          onChange={(next) =>
            save({
              ...prefs,
              columns: { ...prefs.columns, projects: next },
            })
          }
        />
        <ColumnToggles<EditorsColumnId>
          title="Editores"
          options={EDITORS_COLUMNS.map((id) => ({
            id,
            label: EDITORS_COLUMN_LABEL[id],
          }))}
          value={prefs.columns.editors}
          onChange={(next) =>
            save({
              ...prefs,
              columns: { ...prefs.columns, editors: next },
            })
          }
        />
        <ColumnToggles<ClientsColumnId>
          title="Clientes"
          options={CLIENTS_COLUMNS.map((id) => ({
            id,
            label: CLIENTS_COLUMN_LABEL[id],
          }))}
          value={prefs.columns.clients}
          onChange={(next) =>
            save({
              ...prefs,
              columns: { ...prefs.columns, clients: next },
            })
          }
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Pestañas de Finanzas"
          hint="Elegí qué pestañas mostrar en Finanzas. Las que destildés se ocultan del navegador de pestañas."
        />
        <ColumnToggles<FinanzasTabId>
          title="Pestañas"
          options={FINANZAS_TABS.map((id) => ({
            id,
            label: FINANZAS_TAB_LABEL[id],
          }))}
          value={prefs.finanzas.tabs}
          onChange={(next) =>
            save({ ...prefs, finanzas: { tabs: next } })
          }
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle
          title="Listados y paginación"
          hint="Definí cuántos registros traer por vista. Subir el número muestra más; bajarlo acelera la carga cuando hay muchos."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <LimitInput
            label="Proyectos por año"
            value={prefs.limits.projects_per_year}
            onChange={(v) =>
              save({
                ...prefs,
                limits: { ...prefs.limits, projects_per_year: v },
              })
            }
          />
          <LimitInput
            label="Editores por página"
            value={prefs.limits.editors_per_page}
            onChange={(v) =>
              save({
                ...prefs,
                limits: { ...prefs.limits, editors_per_page: v },
              })
            }
          />
          <LimitInput
            label="Clientes por página"
            value={prefs.limits.clients_per_page}
            onChange={(v) =>
              save({
                ...prefs,
                limits: { ...prefs.limits, clients_per_page: v },
              })
            }
          />
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ColumnToggles<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly { id: T; label: string }[];
  value: T[];
  onChange: (next: T[]) => void;
}) {
  function toggle(id: T) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      // Restauramos en el orden canónico definido por `options`.
      const set = new Set<T>([...value, id]);
      onChange(options.filter((o) => set.has(o.id)).map((o) => o.id));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {options.map((opt) => {
          const active = value.includes(opt.id);
          return (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 text-muted-foreground hover:bg-accent/40"
              }`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggle(opt.id)}
                className="size-4 cursor-pointer accent-primary"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function LimitInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  function handleBlur() {
    const n = Number(draft);
    if (Number.isNaN(n) || n < 1) {
      setDraft(String(value));
      toast.error("Tiene que ser un número mayor o igual a 1");
      return;
    }
    if (n !== value) onChange(n);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={1}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        className="h-8"
      />
    </div>
  );
}
