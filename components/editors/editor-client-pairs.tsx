"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronsUpDownIcon, PlusIcon, XIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  EditorTiersEditor,
  type TierDraft,
} from "./editor-tiers-editor";

import { createClient } from "@/lib/clients/actions";
import {
  EDITOR_PAYMENT_TYPES,
  EDITOR_PAYMENT_TYPE_LABEL,
} from "@/lib/projects/types";
import type {
  ClientMini,
  EditorPaymentType,
} from "@/lib/projects/types";

/** Borrador del form. payment_type = null significa "usar global del editor". */
export type ClientPairDraft = {
  client_id: string;
  payment_type: EditorPaymentType | null;
  rate: string;
  flat_amount: string;
  tiers: TierDraft[];
};

const INHERIT = "__inherit__";

type Props = {
  availableClients: ClientMini[];
  value: ClientPairDraft[];
  onChange: (value: ClientPairDraft[]) => void;
};

export function EditorClientPairs({
  availableClients,
  value,
  onChange,
}: Props) {
  const clientById = useMemo(
    () => new Map(availableClients.map((c) => [c.id, c])),
    [availableClients]
  );
  const selectedIds = new Set(value.map((v) => v.client_id));

  function updatePair(index: number, patch: Partial<ClientPairDraft>) {
    onChange(value.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removePair(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addPair(clientId: string) {
    if (selectedIds.has(clientId)) return;
    onChange([
      ...value,
      {
        client_id: clientId,
        payment_type: null,
        rate: "",
        flat_amount: "",
        tiers: [],
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <div className="flex flex-col gap-3">
          {value.map((pair, i) => {
            const client = clientById.get(pair.client_id);
            const name = client?.name ?? "Cliente";
            const color = client?.color;
            return (
              <div
                key={pair.client_id}
                className="flex flex-col gap-3 rounded-lg border bg-card/50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    {color ? (
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ) : null}
                    {name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePair(i)}
                    aria-label={`Quitar ${name}`}
                    className="rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Modelo de pago para este cliente
                    </span>
                    <Select
                      value={pair.payment_type ?? INHERIT}
                      onValueChange={(v) =>
                        v &&
                        updatePair(i, {
                          payment_type:
                            v === INHERIT ? null : (v as EditorPaymentType),
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            if (!v || v === INHERIT)
                              return "Usar el global del editor";
                            return EDITOR_PAYMENT_TYPE_LABEL[
                              v as EditorPaymentType
                            ];
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={INHERIT}>
                          Usar el global del editor
                        </SelectItem>
                        {EDITOR_PAYMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {EDITOR_PAYMENT_TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {pair.payment_type === "por_minuto" ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Rate por minuto (USD)
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={pair.rate}
                        onChange={(e) =>
                          updatePair(i, { rate: e.target.value })
                        }
                        placeholder="0"
                      />
                    </div>
                  ) : null}

                  {pair.payment_type === "flat" ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Monto FLAT por proyecto (USD)
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={pair.flat_amount}
                        onChange={(e) =>
                          updatePair(i, { flat_amount: e.target.value })
                        }
                        placeholder="0"
                      />
                    </div>
                  ) : null}
                </div>

                {pair.payment_type === "flat_variable" ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Tramos por rango de minutos
                    </span>
                    <EditorTiersEditor
                      value={pair.tiers}
                      onChange={(tiers) => updatePair(i, { tiers })}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          Sin clientes asignados.
        </p>
      )}

      <ClientPicker
        availableClients={availableClients}
        excludeIds={selectedIds}
        onAdd={addPair}
      />
    </div>
  );
}

function ClientPicker({
  availableClients,
  excludeIds,
  onAdd,
}: {
  availableClients: ClientMini[];
  excludeIds: Set<string>;
  onAdd: (clientId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const term = search.trim().toLowerCase();
  const filtered =
    term === ""
      ? availableClients
      : availableClients.filter((c) => c.name.toLowerCase().includes(term));
  const exactMatch = availableClients.some(
    (c) => c.name.toLowerCase() === term
  );

  function handleCreate() {
    const name = search.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createClient({ name });
      if (result.ok) {
        toast.success(`Cliente «${name}» creado`);
        onAdd(result.client.id);
        setSearch("");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
          />
        }
      >
        <PlusIcon className="size-4" />
        Agregar cliente
        <ChevronsUpDownIcon className="size-3.5 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" side="bottom" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar o crear cliente…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length > 0 ? (
              <CommandGroup>
                {filtered.map((c) => {
                  const disabled = excludeIds.has(c.id);
                  return (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      disabled={disabled}
                      onSelect={() => {
                        onAdd(c.id);
                        setSearch("");
                        setOpen(false);
                      }}
                    >
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                      {disabled ? (
                        <span className="ml-auto text-xs text-muted-foreground">
                          ya asignado
                        </span>
                      ) : null}
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
                  Crear «{search.trim()}»{pending ? " …" : ""}
                </CommandItem>
              </CommandGroup>
            ) : null}
            {filtered.length === 0 && term.length === 0 ? (
              <CommandEmpty>No hay clientes cargados.</CommandEmpty>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
