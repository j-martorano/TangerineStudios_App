"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronsUpDownIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

import {
  createPaymentMethod,
  deletePaymentMethod,
} from "@/lib/payment-methods/actions";
import type { PaymentMethod } from "@/lib/payment-methods/queries";

export type EditorMethodValue = {
  method_id: string;
  name: string;
  info: string;
};

type Props = {
  catalog: PaymentMethod[];
  value: EditorMethodValue[];
  onChange: (value: EditorMethodValue[]) => void;
};

export function EditorPaymentMethods({ catalog, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  // Métodos creados durante la edición que todavía no están en el catálogo
  // que llegó del server.
  const [extraCatalog, setExtraCatalog] = useState<PaymentMethod[]>([]);

  const fullCatalog = useMemo(() => {
    const map = new Map<string, PaymentMethod>();
    for (const m of catalog) map.set(m.id, m);
    for (const m of extraCatalog) if (!map.has(m.id)) map.set(m.id, m);
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [catalog, extraCatalog]);

  const selectedIds = new Set(value.map((v) => v.method_id));
  const term = search.trim().toLowerCase();
  const filtered =
    term === ""
      ? fullCatalog
      : fullCatalog.filter((m) => m.name.toLowerCase().includes(term));
  const exactMatch = fullCatalog.some((m) => m.name.toLowerCase() === term);

  function addMethod(method: PaymentMethod) {
    if (selectedIds.has(method.id)) return;
    onChange([
      ...value,
      { method_id: method.id, name: method.name, info: "" },
    ]);
  }

  function removeMethod(methodId: string) {
    onChange(value.filter((v) => v.method_id !== methodId));
  }

  function updateInfo(methodId: string, info: string) {
    onChange(
      value.map((v) => (v.method_id === methodId ? { ...v, info } : v))
    );
  }

  function handleCreate() {
    const name = search.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createPaymentMethod({ name });
      if (result.ok) {
        toast.success(`Método «${name}» creado`);
        setExtraCatalog((prev) => [...prev, result.method]);
        addMethod(result.method);
        setSearch("");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDeleteFromCatalog(method: PaymentMethod) {
    startTransition(async () => {
      const result = await deletePaymentMethod(method.id);
      if (result.ok) {
        toast.success(`Método «${method.name}» eliminado del catálogo`);
        setExtraCatalog((prev) => prev.filter((m) => m.id !== method.id));
        // También lo sacamos de la selección de este editor si estaba.
        onChange(value.filter((v) => v.method_id !== method.id));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <div className="flex flex-col gap-2">
          {value.map((v) => (
            <div
              key={v.method_id}
              className="flex flex-col gap-2 rounded-lg border bg-card/50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                  {v.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeMethod(v.method_id)}
                  aria-label={`Quitar ${v.name}`}
                  className="rounded-full text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
              <Textarea
                rows={2}
                value={v.info}
                onChange={(e) => updateInfo(v.method_id, e.target.value)}
                placeholder={`Datos de ${v.name} (alias, usuario, CBU/CVU…)`}
              />
            </div>
          ))}
        </div>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
            />
          }
        >
          <span className="text-muted-foreground">Agregar método de pago</span>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent
          className="w-(--anchor-width) min-w-64 p-0"
          side="bottom"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar o crear método…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {filtered.length > 0 ? (
                <CommandGroup>
                  {filtered.map((method) => {
                    const isSelected = selectedIds.has(method.id);
                    return (
                      <CommandItem
                        key={method.id}
                        value={method.name}
                        disabled={isSelected || pending}
                        onSelect={() => addMethod(method)}
                        className="justify-between"
                      >
                        <span
                          className={isSelected ? "text-muted-foreground" : ""}
                        >
                          {method.name}
                          {isSelected ? " · agregado" : ""}
                        </span>
                        <button
                          type="button"
                          aria-label={`Eliminar ${method.name} del catálogo`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteFromCatalog(method);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}
              {term.length > 0 && !exactMatch ? (
                <CommandGroup heading="Crear nuevo">
                  <CommandItem
                    value={`__create_${term}`}
                    onSelect={handleCreate}
                    disabled={pending}
                  >
                    <PlusIcon className="size-4" />
                    <span>
                      Crear «{search.trim()}»{pending ? " …" : ""}
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {filtered.length === 0 && term.length === 0 ? (
                <CommandEmpty>
                  No hay métodos en el catálogo. Escribí uno para crearlo.
                </CommandEmpty>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
