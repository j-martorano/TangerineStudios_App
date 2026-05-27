"use client";

import { useState, useTransition } from "react";
import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
  upsertServiceMonthEntry,
  deleteServiceMonthEntry,
  seedMonthEntries,
} from "@/lib/finanzas/actions";
import { formatPrice } from "@/lib/projects/format";
import type { FixedService } from "@/lib/finanzas/queries";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AppEntry = {
  service_id: string;
  name: string;
  amount: number;
};

type MonthlyApplicationEntry = {
  key: string;         // "YYYY-MM"
  label: string;       // "mayo 2026"
  servicesCost: number;
  isPast: boolean;     // true = mes ya terminado, editable desde DB
  isSeeded: boolean;   // true = ya tiene entradas en DB (solo para isPast)
  entries: AppEntry[];
};

type Props = {
  services: FixedService[];
  monthlyApplication?: MonthlyApplicationEntry[];
  currentMonthKey?: string;
};

// ── Componente principal ───────────────────────────────────────────────────────

export function FixedServicesSection({
  services,
  monthlyApplication = [],
  currentMonthKey,
}: Props) {
  const activeTotal = services
    .filter((s) => s.active)
    .reduce((sum, s) => sum + s.monthly_cost, 0);

  return (
    <section className="flex flex-col gap-6">
      {/* ── Lista de servicios + form ── */}
      <div className="flex flex-col gap-3">
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
          Los servicios <strong>activos</strong> se descuentan este mes. Los
          pausados no descuentan. Cada mes pasado tiene su propio registro
          editable abajo.
        </p>
      </div>

      {/* ── Log de aplicación mensual ── */}
      {monthlyApplication.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Aplicación por mes
            </h2>
            <span className="text-xs text-muted-foreground">
              {monthlyApplication.length} mes
              {monthlyApplication.length === 1 ? "" : "es"} ·{" "}
              {formatPrice(
                monthlyApplication.reduce((s, m) => s + m.servicesCost, 0)
              )}{" "}
              total descontado
            </span>
          </div>
          <Card>
            <CardContent className="divide-y divide-border/40 p-0">
              {monthlyApplication.map((m) => (
                <MonthApplicationRow
                  key={m.key}
                  entry={m}
                  allServices={services}
                  isCurrent={m.key === currentMonthKey}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {monthlyApplication.length === 0 && services.some((s) => s.active) && (
        <p className="text-xs italic text-muted-foreground">
          Todavía no hay meses con actividad para mostrar el historial.
        </p>
      )}
    </section>
  );
}

// ── Fila del log mensual ───────────────────────────────────────────────────────

function MonthApplicationRow({
  entry,
  allServices,
  isCurrent,
}: {
  entry: MonthlyApplicationEntry;
  allServices: FixedService[];
  isCurrent: boolean;
}) {
  const [open, setOpen] = useState(isCurrent);
  const [pending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addServiceId, setAddServiceId] = useState("");
  const [addAmount, setAddAmount] = useState("");

  // Servicios que aún no tienen entrada en este mes (para el selector de "agregar")
  const availableToAdd = allServices.filter(
    (s) => !entry.entries.some((e) => e.service_id === s.id)
  );

  function handleSeed() {
    startTransition(async () => {
      const result = await seedMonthEntries(entry.key);
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleAdd() {
    const amount = parseFloat(addAmount);
    if (!addServiceId || Number.isNaN(amount) || amount < 0) return;
    startTransition(async () => {
      const result = await upsertServiceMonthEntry({
        service_id: addServiceId,
        year_month: entry.key,
        amount,
      });
      if (result.ok) {
        setAddServiceId("");
        setAddAmount("");
        setShowAddForm(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(service_id: string) {
    startTransition(async () => {
      const result = await deleteServiceMonthEntry({
        service_id,
        year_month: entry.key,
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleAmountEdit(service_id: string, amount: number) {
    startTransition(async () => {
      const result = await upsertServiceMonthEntry({
        service_id,
        year_month: entry.key,
        amount,
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  const noEntries = entry.isPast && !entry.isSeeded;

  return (
    <div className={isCurrent ? "bg-muted/40" : ""}>
      {/* Fila principal */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <ChevronDownIcon
            className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
          <span className="capitalize text-sm">{entry.label}</span>
          {isCurrent && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
              Este mes
            </span>
          )}
          {noEntries && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              Sin registrar
            </span>
          )}
        </div>
        <span
          className={`tabular-nums text-sm font-medium ${
            entry.servicesCost > 0 ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {entry.servicesCost > 0 ? `−${formatPrice(entry.servicesCost)}` : "—"}
        </span>
      </button>

      {/* Detalle desplegable */}
      {open && (
        <div className="border-t border-border/30 bg-muted/10">
          {/* Mes actual: solo lectura */}
          {isCurrent && (
            <ul className="flex flex-col divide-y divide-border/20">
              {entry.entries.length === 0 ? (
                <li className="px-6 py-2 text-xs italic text-muted-foreground">
                  No hay servicios activos este mes.
                </li>
              ) : (
                entry.entries.map((e) => (
                  <li
                    key={e.service_id}
                    className="flex items-center justify-between gap-3 px-6 py-1.5"
                  >
                    <span className="text-xs text-muted-foreground">{e.name}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      −{formatPrice(e.amount)}
                    </span>
                  </li>
                ))
              )}
              <li className="px-6 py-2 text-[10px] italic text-muted-foreground/70">
                El mes actual no es editable — se registrará automáticamente al
                cerrarse.
              </li>
            </ul>
          )}

          {/* Mes pasado con entradas: editable */}
          {entry.isPast && entry.isSeeded && (
            <div className="flex flex-col">
              <ul className="flex flex-col divide-y divide-border/20">
                {entry.entries.map((e) => (
                  <PastEntryRow
                    key={e.service_id}
                    entry={e}
                    onEdit={(amount) => handleAmountEdit(e.service_id, amount)}
                    onDelete={() => handleDelete(e.service_id)}
                    pending={pending}
                  />
                ))}
              </ul>

              {/* Agregar otro servicio a este mes */}
              {availableToAdd.length > 0 && (
                <div className="border-t border-border/20 px-6 py-2">
                  {!showAddForm ? (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(true)}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      + Agregar servicio a este mes
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={addServiceId}
                        onChange={(e) => {
                          const svc = allServices.find(
                            (s) => s.id === e.target.value
                          );
                          setAddServiceId(e.target.value);
                          if (svc) setAddAmount(String(svc.monthly_cost));
                        }}
                        disabled={pending}
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="">Seleccioná un servicio</option>
                        {availableToAdd.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        disabled={pending}
                        className="h-7 w-24 text-right text-xs tabular-nums"
                        placeholder="Monto"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAdd}
                        disabled={pending || !addServiceId}
                      >
                        {pending ? "…" : "Agregar"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAddForm(false)}
                        disabled={pending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mes pasado sin entradas: botón para registrar */}
          {entry.isPast && !entry.isSeeded && (
            <div className="flex flex-col items-start gap-2 px-6 py-3">
              <p className="text-xs text-muted-foreground">
                No hay gastos registrados para este mes.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSeed}
                disabled={pending}
              >
                {pending
                  ? "Registrando…"
                  : "Registrar desde servicios activos actuales"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Fila de entrada editable (mes pasado) ─────────────────────────────────────

function PastEntryRow({
  entry,
  onEdit,
  onDelete,
  pending,
}: {
  entry: AppEntry;
  onEdit: (amount: number) => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [amount, setAmount] = useState(String(entry.amount));

  function handleBlur() {
    const n = parseFloat(amount);
    if (!Number.isNaN(n) && n >= 0 && n !== entry.amount) onEdit(n);
  }

  return (
    <li className="flex items-center gap-3 px-6 py-1.5">
      <span className="flex-1 text-xs text-muted-foreground">{entry.name}</span>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={handleBlur}
        disabled={pending}
        className="h-7 w-24 text-right text-xs tabular-nums"
      />
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label="Eliminar gasto de este mes"
        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive disabled:cursor-not-allowed"
      >
        <Trash2Icon className="size-3" />
      </button>
    </li>
  );
}

// ── CRUD de servicios ─────────────────────────────────────────────────────────

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
    if (!Number.isNaN(n) && n >= 0 && n !== service.monthly_cost)
      save({ monthly_cost: n });
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
            definitivamente junto con todo su historial mensual.
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
      <Button type="button" size="sm" disabled={pending} onClick={handleAdd}>
        <PlusIcon className="size-4" />
        {pending ? "Agregando…" : "Agregar"}
      </Button>
    </div>
  );
}
