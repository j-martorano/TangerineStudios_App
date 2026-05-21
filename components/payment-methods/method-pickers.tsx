"use client";

import { ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  PAYMENT_METHOD_COLORS,
  PAYMENT_METHOD_ICONS,
  iconForKey,
} from "./icon-map";

/** Popover con grid de íconos. Valor = icon key (string) o null. */
export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string | null;
  color: string;
  onChange: (key: string | null) => void;
}) {
  const Selected = iconForKey(value);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            aria-label="Elegir ícono"
          />
        }
      >
        {Selected ? (
          <Selected className="size-4" style={{ color }} />
        ) : (
          <span className="text-xs text-muted-foreground">Sin ícono</span>
        )}
        <ChevronsUpDownIcon className="size-3 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>Elegí un ícono</span>
          {value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded text-muted-foreground hover:text-foreground"
            >
              Sin ícono
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {PAYMENT_METHOD_ICONS.map(({ key, Icon, label }) => {
            const active = value === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                title={label}
                className={`flex size-8 items-center justify-center rounded-md border transition-colors ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-transparent hover:bg-accent"
                }`}
              >
                <Icon
                  className="size-4"
                  style={{ color: active ? color : undefined }}
                />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Fila de swatches de color. Valor = hex (#aabbcc). */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PAYMENT_METHOD_COLORS.map((c) => {
        const active = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Color ${c}`}
            className={`size-6 rounded-full ring-2 transition-all ${
              active
                ? "ring-foreground scale-110"
                : "ring-transparent hover:ring-foreground/30"
            }`}
            style={{ backgroundColor: c }}
          />
        );
      })}
    </div>
  );
}
