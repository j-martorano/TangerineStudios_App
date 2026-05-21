"use client";

import { useState, useTransition } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

import {
  createPaymentMethod,
  deletePaymentMethod,
} from "@/lib/payment-methods/actions";
import type { PaymentMethod } from "@/lib/payment-methods/queries";

type Props = {
  methods: PaymentMethod[];
};

export function PaymentMethodsManager({ methods }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-0 p-0">
        {methods.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs italic text-muted-foreground">
            Sin métodos cargados. Agregá el primero abajo.
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {methods.map((m) => (
              <MethodRow key={m.id} method={m} />
            ))}
          </div>
        )}
        <AddMethodRow />
      </CardContent>
    </Card>
  );
}

function MethodRow({ method }: { method: PaymentMethod }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    toast.warning(`¿Eliminar «${method.name}» permanentemente?`, {
      description:
        "Se borra del catálogo y de todos los editores que lo tengan asignado.",
      duration: 10000,
      action: {
        label: "Eliminar",
        onClick: () => {
          startTransition(async () => {
            const result = await deletePaymentMethod(method.id);
            if (result.ok)
              toast.success(`«${method.name}» eliminado`);
            else toast.error(result.error);
          });
        },
      },
      cancel: { label: "Cancelar", onClick: () => {} },
    });
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm">{method.name}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        onClick={handleDelete}
        aria-label="Eliminar método del catálogo"
        className="text-destructive hover:bg-destructive/20 hover:text-destructive"
      >
        <Trash2Icon className="size-4" />
      </Button>
    </div>
  );
}

function AddMethodRow() {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Ingresá un nombre para el método");
      return;
    }
    startTransition(async () => {
      const result = await createPaymentMethod({ name: trimmed });
      if (result.ok) {
        toast.success(`«${trimmed}» agregado`);
        setName("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border/40 bg-muted/30 px-4 py-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
        }}
        disabled={pending}
        placeholder="Nuevo método (ej. Binance, DolarApp, banco BBVA)"
        className="h-8 min-w-40 flex-1"
        aria-label="Nombre del nuevo método"
      />
      <Button type="button" size="sm" disabled={pending} onClick={handleAdd}>
        <PlusIcon className="size-4" />
        {pending ? "Agregando…" : "Agregar"}
      </Button>
    </div>
  );
}
