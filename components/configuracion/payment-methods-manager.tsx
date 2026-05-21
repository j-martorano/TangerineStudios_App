"use client";

import { useState, useTransition } from "react";
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MethodIcon } from "@/components/payment-methods/method-icon";
import {
  ColorPicker,
  IconPicker,
} from "@/components/payment-methods/method-pickers";
import { methodTint } from "@/components/payment-methods/icon-map";

import {
  createPaymentMethod,
  deletePaymentMethod,
  updatePaymentMethod,
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
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(method.name);
  const [icon, setIcon] = useState<string | null>(method.icon);
  const [color, setColor] = useState<string>(method.color);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName(method.name);
    setIcon(method.icon);
    setColor(method.color);
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("El nombre no puede quedar vacío");
      return;
    }
    startTransition(async () => {
      const result = await updatePaymentMethod({
        id: method.id,
        name: trimmed,
        icon,
        color,
      });
      if (result.ok) {
        toast.success(`«${trimmed}» actualizado`);
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  }

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
            if (result.ok) toast.success(`«${method.name}» eliminado`);
            else toast.error(result.error);
          });
        },
      },
      cancel: { label: "Cancelar", onClick: () => {} },
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3 px-4 py-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          className="h-8"
          autoFocus
        />
        <div className="flex flex-wrap items-center gap-2">
          <IconPicker value={icon} color={color} onChange={setIcon} />
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              reset();
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={handleSave}
          >
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span
        className="inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-sm"
        style={{ backgroundColor: methodTint(method.color) }}
      >
        <MethodIcon
          name={method.name}
          icon={method.icon}
          className="size-3.5"
        />
        <span style={{ color: method.color }}>•</span>
        {method.name}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setEditing(true)}
          aria-label="Editar método"
        >
          <PencilIcon className="size-4" />
        </Button>
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
    </div>
  );
}

function AddMethodRow() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string>("#888888");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Ingresá un nombre para el método");
      return;
    }
    startTransition(async () => {
      const result = await createPaymentMethod({
        name: trimmed,
        icon,
        color,
      });
      if (result.ok) {
        toast.success(`«${trimmed}» agregado`);
        setName("");
        setIcon(null);
        setColor("#888888");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <div className="flex justify-center border-t border-border/40 bg-muted/30 px-4 py-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          <PlusIcon className="size-4" />
          Agregar método
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border/40 bg-muted/30 px-4 py-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
        }}
        disabled={pending}
        placeholder="Nuevo método (ej. Binance, DolarApp, BBVA)"
        className="h-8"
        autoFocus
        aria-label="Nombre del nuevo método"
      />
      <div className="flex flex-wrap items-center gap-2">
        <IconPicker value={icon} color={color} onChange={setIcon} />
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setName("");
            setIcon(null);
            setColor("#888888");
            setOpen(false);
          }}
        >
          <XIcon className="size-4" />
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={handleAdd}>
          <PlusIcon className="size-4" />
          {pending ? "Agregando…" : "Agregar"}
        </Button>
      </div>
    </div>
  );
}
