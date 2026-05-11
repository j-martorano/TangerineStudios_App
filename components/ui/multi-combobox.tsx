"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, XIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

type ItemBase = { id: string; name: string };

type Props<T extends ItemBase> = {
  items: T[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Si está definido, ofrece crear un item nuevo desde el input cuando no hay match exacto. */
  onCreate?: (name: string) => Promise<T | null>;
  placeholder?: string;
  emptyText?: string;
  renderTag?: (item: T) => ReactNode;
  renderOption?: (item: T) => ReactNode;
};

export function MultiCombobox<T extends ItemBase>({
  items,
  selected,
  onChange,
  onCreate,
  placeholder = "Seleccionar…",
  emptyText = "Sin opciones",
  renderTag,
  renderOption,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [localItems, setLocalItems] = useState<T[]>(items);

  const allItems = useMemo(() => {
    const map = new Map<string, T>();
    for (const i of items) map.set(i.id, i);
    for (const i of localItems) if (!map.has(i.id)) map.set(i.id, i);
    return Array.from(map.values());
  }, [items, localItems]);

  const selectedItems = useMemo(
    () => selected.map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as T[],
    [selected, allItems]
  );

  const term = search.trim().toLowerCase();
  const filtered =
    term === ""
      ? allItems
      : allItems.filter((i) => i.name.toLowerCase().includes(term));
  const exactMatch = allItems.some((i) => i.name.toLowerCase() === term);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  function handleCreate() {
    if (!onCreate) return;
    const name = search.trim();
    if (!name) return;
    startTransition(async () => {
      const created = await onCreate(name);
      if (created) {
        toast.success(`«${name}» creado`);
        setLocalItems((prev) => [...prev, created]);
        onChange([...selected, created.id]);
        setSearch("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {selectedItems.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
            >
              {renderTag ? renderTag(item) : <span>{item.name}</span>}
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Quitar ${item.name}`}
                className="rounded-full text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </span>
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
          <span className="text-muted-foreground">{placeholder}</span>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent
          className="w-(--anchor-width) min-w-64 p-0"
          side="bottom"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={onCreate ? "Buscar o crear…" : "Buscar…"}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {filtered.length > 0 ? (
                <CommandGroup>
                  {filtered.map((item) => {
                    const isSelected = selected.includes(item.id);
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.name}
                        onSelect={() => toggle(item.id)}
                      >
                        <CheckIcon
                          className={cn(
                            "size-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {renderOption ? renderOption(item) : <span>{item.name}</span>}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}
              {onCreate && term.length > 0 && !exactMatch ? (
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
                <CommandEmpty>{emptyText}</CommandEmpty>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
