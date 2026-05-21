"use client";

import { useState, useTransition } from "react";
import { DatabaseIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { activateSeed, deactivateSeed } from "@/lib/seed/actions";

type Props = {
  initialActive: boolean;
};

export function SeedSection({ initialActive }: Props) {
  const [active, setActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = active ? await deactivateSeed() : await activateSeed();
      if (result.ok) {
        setActive(!active);
        toast.success(
          active
            ? "Datos de prueba removidos"
            : "Datos de prueba cargados"
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <DatabaseIcon className="size-4" />
          Datos de prueba (seed)
        </h3>
        <p className="text-xs text-muted-foreground">
          {active
            ? "Activos. La base tiene cargados 3 editores, 5 clientes y 15 proyectos en marzo/abril/mayo de 2026 con pares cliente-editor configurados, pagos retainer y un proyecto pendiente para probar el auto-carry."
            : "Inactivos. Activá para cargar datos de prueba que cubren los 3 modelos de pago de editor, pares con override por cliente, pagos retainer con minutos acreditados, servicios fijos y un proyecto pendiente de un mes viejo para probar el auto-carry del kanban."}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Todos los rows del seed empiezan con «[SEED]» y se pueden remover en
          un click.
        </p>
      </div>
      <Button
        variant={active ? "outline" : "default"}
        disabled={pending}
        onClick={handleToggle}
      >
        {pending
          ? active
            ? "Removiendo…"
            : "Cargando…"
          : active
            ? "Desactivar seed"
            : "Activar seed"}
      </Button>
    </div>
  );
}
