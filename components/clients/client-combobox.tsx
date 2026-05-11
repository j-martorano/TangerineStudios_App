"use client";

import { useState, useTransition } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
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

import { createClient } from "@/lib/clients/actions";
import type { ClientMini } from "@/lib/projects/types";

type Props = {
  clients: ClientMini[];
  value: string | null;
  onChange: (clientId: string | null, client?: ClientMini) => void;
};

export function ClientCombobox({ clients, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [localClients, setLocalClients] = useState(clients);

  const selected = localClients.find((c) => c.id === value) ?? null;

  const term = search.trim().toLowerCase();
  const filtered =
    term === ""
      ? localClients
      : localClients.filter((c) => c.name.toLowerCase().includes(term));
  const exactMatch = localClients.some((c) => c.name.toLowerCase() === term);

  function handleCreate() {
    const name = search.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createClient({ name });
      if (result.ok) {
        toast.success(`Cliente «${name}» creado`);
        setLocalClients((prev) => [...prev, result.client]);
        onChange(result.client.id, result.client);
        setSearch("");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleClear() {
    onChange(null);
    setOpen(false);
    setSearch("");
  }

  return (
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
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.name : "Sin asignar"}
        </span>
        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-(--anchor-width) min-w-64 p-0"
        side="bottom"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar o crear cliente…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length > 0 && (
              <CommandGroup>
                {selected && (
                  <CommandItem
                    value="__clear"
                    onSelect={handleClear}
                    className="text-muted-foreground"
                  >
                    <span className="size-4" />
                    <span>Quitar selección</span>
                  </CommandItem>
                )}
                {filtered.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => {
                      onChange(c.id, c);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4",
                        value === c.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{c.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {term.length > 0 && !exactMatch && (
              <CommandGroup heading="Crear nuevo">
                <CommandItem
                  value={`__create_${term}`}
                  onSelect={handleCreate}
                  disabled={pending}
                >
                  <PlusIcon className="size-4" />
                  <span>
                    Crear «{search.trim()}»
                    {pending ? " …" : ""}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length === 0 && term.length === 0 && (
              <CommandEmpty>Sin clientes cargados</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
