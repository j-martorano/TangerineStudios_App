"use client";

import { PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Borrador de un tramo mientras se edita el formulario (valores como string). */
export type TierDraft = { min: string; max: string; amount: string };

type Props = {
  value: TierDraft[];
  onChange: (value: TierDraft[]) => void;
};

/**
 * Editor de tramos para el modelo FLAT variable: cada fila es un rango de
 * minutos con su monto fijo.
 */
export function EditorTiersEditor({ value, onChange }: Props) {
  function update(index: number, patch: Partial<TierDraft>) {
    onChange(value.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add() {
    // El nuevo tramo arranca donde terminó el anterior.
    const last = value[value.length - 1];
    onChange([...value, { min: last?.max ?? "", max: "", amount: "" }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>Desde (min)</span>
            <span>Hasta (min)</span>
            <span>Monto USD</span>
            <span className="w-8" />
          </div>
          {value.map((tier, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2"
            >
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={tier.min}
                onChange={(e) => update(i, { min: e.target.value })}
                placeholder="10"
                className="h-8"
                aria-label={`Minuto inicial del tramo ${i + 1}`}
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={tier.max}
                onChange={(e) => update(i, { max: e.target.value })}
                placeholder="15"
                className="h-8"
                aria-label={`Minuto final del tramo ${i + 1}`}
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={tier.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
                placeholder="100"
                className="h-8"
                aria-label={`Monto del tramo ${i + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(i)}
                aria-label={`Quitar tramo ${i + 1}`}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          Sin tramos cargados. Agregá el primero.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-fit"
      >
        <PlusIcon className="size-4" />
        Agregar tramo
      </Button>
    </div>
  );
}
