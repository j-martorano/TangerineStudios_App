"use client";

import { useState, useTransition } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  createFixedService,
  deleteFixedService,
  updateFixedService,
} from "@/lib/finanzas/actions";
import { formatPrice } from "@/lib/projects/format";
import type { FixedService } from "@/lib/finanzas/queries";

type Props = {
  services: FixedService[];
};

export function FixedServicesSection({ services }: Props) {
  const activeTotal = services
    .filter((s) => s.active)
    .reduce((sum, s) => sum + s.monthly_cost, 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Servicios fijos
        </h2>
        <span className="text-xs text-muted-foreground">
          {formatPrice(activeTotal)} / mes ·{" "}
          {services.filter((s) => s.active).length} activo
          {services.filter((s) => s.active).length === 1 ? "" : "s"}
        </span>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-0 p-0">
          {services.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs italic text-muted-foreground">
              No hay servicios fijos cargados. Agregá el primero abajo.
            </p>
          ) : (
            <div className="divide-y divide-border/40">
              {services.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </div>
          )}
          <AddServiceRow />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        El costo de los servicios activos se resta de la ganancia de cada mes.
      </p>
    </section>
  );
}

function ServiceRow({ service }: { service: FixedService }) {
  const [name, setName] = useState(service.name);
  const [cost, setCost] = useState(String(service.monthly_cost));
  const [active, setActive] = useState(service.active);
  const [pending, startTransition] = useTransition();

  function save(next: {
    name?: string;
    monthly_cost?: number;
    active?: boolean;
  }) {
    const payload = {
      id: service.id,
      name: next.name ?? name,
      monthly_cost: next.monthly_cost ?? Number(cost),
      active: next.active ?? active,
    };
    startTransition(async () => {
      const result = await updateFixedService(payload);
      if (!result.ok) {
        toast.error(result.error);
        // Revertir al estado guardado
        setName(service.name);
        setCost(String(service.monthly_cost));
        setActive(service.active);
      }
    });
  }

  function handleNameBlur() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== service.name) save({ name: trimmed });
  }

  function handleCostBlur() {
    const n = Number(cost);
    if (!Number.isNaN(n) && n >= 0 && n !== service.monthly_cost) {
      save({ monthly_cost: n });
    }
  }

  function toggleActive() {
    const next = !active;
    setActive(next);
    save({ active: next });
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
        active ? "" : "opacity-50"
      }`}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleNameBlur}
        disabled={pending}
        className="h-8 min-w-40 flex-1"
        aria-label="Nombre del servicio"
      />
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">USD</span>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          onBlur={handleCostBlur}
          disabled={pending}
          className="h-8 w-28 text-right tabular-nums"
          aria-label="Costo mensual"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant={active ? "ghost" : "outline"}
        disabled={pending}
        onClick={toggleActive}
        className="w-20"
      >
        {active ? "Activo" : "Pausado"}
      </Button>
      <DeleteServiceButton id={service.id} name={service.name} />
    </div>
  );
}

function DeleteServiceButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteFixedService(id);
      if (result.ok) {
        toast.success(`Servicio «${name}» eliminado`);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar servicio"
            type="button"
            className="text-destructive hover:bg-destructive/20 hover:text-destructive"
          />
        }
      >
        <Trash2Icon className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar «{name}»</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. El servicio se borra
            definitivamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AddServiceRow() {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Ingresá un nombre para el servicio");
      return;
    }
    const n = Number(cost || 0);
    if (Number.isNaN(n) || n < 0) {
      toast.error("El costo debe ser un número válido");
      return;
    }
    startTransition(async () => {
      const result = await createFixedService({
        name: trimmed,
        monthly_cost: n,
      });
      if (result.ok) {
        toast.success(`Servicio «${trimmed}» agregado`);
        setName("");
        setCost("");
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
        placeholder="Nuevo servicio (ej. Adobe Creative Cloud)"
        className="h-8 min-w-40 flex-1"
        aria-label="Nombre del nuevo servicio"
      />
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">USD</span>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          disabled={pending}
          placeholder="0"
          className="h-8 w-28 text-right tabular-nums"
          aria-label="Costo mensual del nuevo servicio"
        />
      </div>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={handleAdd}
      >
        <PlusIcon className="size-4" />
        {pending ? "Agregando…" : "Agregar"}
      </Button>
    </div>
  );
}
