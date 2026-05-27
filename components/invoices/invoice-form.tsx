"use client";

import { useState, useTransition, useEffect } from "react";
import { PlusIcon, XIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

import { createInvoice } from "@/lib/invoices/actions";
import { CURRENCY_OPTIONS } from "@/lib/invoices/types";
import type { InvoiceItem } from "@/lib/invoices/types";
import type { ClientForProject } from "@/lib/projects/types";
import type { ProjectWithRelations } from "@/lib/projects/types";
import { computePrice } from "@/lib/projects/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmt(symbol: string, amount: number): string {
  return `${symbol}${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function emptyItem(): InvoiceItem {
  return { name: "", description: "", quantity: 1, rate: 0 };
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  projects: ProjectWithRelations[];
  clients: ClientForProject[];
  onSuccess?: () => void;
};

// ── Componente ────────────────────────────────────────────────────────────────

export function InvoiceForm({ projects, onSuccess }: Props) {
  const [pending, startTransition] = useTransition();

  // — Campos base —
  const [date, setDate] = useState(today());
  const [currency, setCurrency] = useState("$");

  // — Proyectos vinculados —
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // — Cliente —
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientCountry, setClientCountry] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);

  // — Ítems —
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);

  // — Descuento —
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState<string>("");

  // — Upfront —
  const [upfrontEnabled, setUpfrontEnabled] = useState(false);
  const [upfrontPct, setUpfrontPct] = useState<string>("50");

  // — Notas —
  const [notes, setNotes] = useState("");

  // ── Auto-fill desde proyectos seleccionados ─────────────────────────────────

  useEffect(() => {
    if (selectedProjectIds.length === 0) return;

    const sel = projects.filter((p) => selectedProjectIds.includes(p.id));

    // Pre-completar cliente solo si todos los proyectos tienen el mismo
    const uniqueClientIds = [...new Set(sel.map((p) => p.client_id).filter(Boolean))];
    if (uniqueClientIds.length === 1 && sel[0].client) {
      const c = sel[0].client;
      setClientName((prev) => prev || c.name);
      setClientId(sel[0].client_id ?? null);
    }

    // Pre-completar ítems desde proyectos
    const autoItems: InvoiceItem[] = sel.map((p) => {
      const price = computePrice(p) ?? 0;
      return {
        name: p.title,
        description: p.project_code ?? "",
        quantity: 1,
        rate: price,
      };
    });
    setItems(autoItems.length > 0 ? autoItems : [emptyItem()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectIds]);

  // ── Cálculos en vivo ────────────────────────────────────────────────────────

  const subtotal = items.reduce((s, it) => s + it.quantity * it.rate, 0);
  const discVal = parseFloat(discountValue) || 0;
  const discountAmt =
    discountEnabled && discVal > 0
      ? discountType === "percentage"
        ? subtotal * (discVal / 100)
        : discVal
      : 0;
  const afterDiscount = subtotal - discountAmt;
  const upPct = parseFloat(upfrontPct) || 0;
  const upfrontAmt = upfrontEnabled && upPct > 0 ? afterDiscount * (upPct / 100) : 0;
  const total = afterDiscount - upfrontAmt;

  // ── Ítems ───────────────────────────────────────────────────────────────────

  function addItem() {
    setItems([...items, emptyItem()]);
  }

  function removeItem(i: number) {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  }

  function setItemField<K extends keyof InvoiceItem>(
    i: number,
    key: K,
    value: InvoiceItem[K]
  ) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  }

  // ── Proyectos ───────────────────────────────────────────────────────────────

  function toggleProject(pid: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clientName.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }
    if (items.some((it) => !it.name.trim())) {
      toast.error("Todos los ítems deben tener nombre");
      return;
    }

    startTransition(async () => {
      const result = await createInvoice({
        date,
        currency_symbol: currency,
        client_name: clientName.trim(),
        client_address: clientAddress.trim(),
        client_country: clientCountry.trim(),
        client_id: clientId,
        items: items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          rate: Number(it.rate),
        })),
        discount: {
          enabled: discountEnabled,
          type: discountType,
          value: discVal,
        },
        upfront: {
          enabled: upfrontEnabled,
          percentage: upPct,
        },
        notes: notes.trim(),
        project_ids: selectedProjectIds,
      });

      if (result.ok) {
        toast.success("Factura generada correctamente");
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const topLevelProjects = projects.filter((p) => !p.parent_id && !p.archived);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">

        {/* ── Fecha y moneda ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-date">Fecha</Label>
            <Input
              id="inv-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-currency">Moneda</Label>
            <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
              <SelectTrigger id="inv-currency" className="w-full">
                <SelectValue>{(v: string | null) => v ?? ""}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Proyectos vinculados ── */}
        {topLevelProjects.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label>Proyectos vinculados <span className="text-xs text-muted-foreground font-normal">(opcional — auto-rellena ítems)</span></Label>
            <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
              {topLevelProjects.map((p) => {
                const selected = selectedProjectIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProject(p.id)}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      selected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {selected ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <span className="flex-1 truncate">{p.title}</span>
                    {p.client ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.client.name}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ── Cliente ── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Bill To
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-client">Nombre <span className="text-destructive">*</span></Label>
            <Input
              id="inv-client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre del cliente"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-address">Dirección</Label>
            <textarea
              id="inv-address"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              placeholder="Dirección (puede ser multilínea)"
              rows={2}
              className="flex min-h-[4rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-country">País</Label>
            <Input
              id="inv-country"
              value={clientCountry}
              onChange={(e) => setClientCountry(e.target.value)}
              placeholder="País"
            />
          </div>
        </div>

        {/* ── Ítems ── */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ítems
          </p>
          <div className="grid grid-cols-[1fr_64px_96px_auto] gap-x-2 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>Nombre / Descripción</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">Tarifa</span>
            <span className="w-8" />
          </div>
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="grid grid-cols-[1fr_64px_96px_auto] items-start gap-x-2">
                <div className="flex flex-col gap-1">
                  <Input
                    value={item.name}
                    onChange={(e) => setItemField(i, "name", e.target.value)}
                    placeholder={`Ítem ${i + 1}`}
                    required
                  />
                  <Input
                    value={item.description}
                    onChange={(e) => setItemField(i, "description", e.target.value)}
                    placeholder="Descripción (opcional)"
                    className="text-xs text-muted-foreground"
                  />
                </div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => setItemField(i, "quantity", parseFloat(e.target.value) || 0)}
                  className="text-right tabular-nums"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.rate}
                  onChange={(e) => setItemField(i, "rate", parseFloat(e.target.value) || 0)}
                  className="text-right tabular-nums"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                  aria-label="Quitar ítem"
                  className="mt-1"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
              {/* Monto calculado del ítem */}
              <p className="pr-10 text-right text-xs text-muted-foreground tabular-nums">
                {fmt(currency, item.quantity * item.rate)}
              </p>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="w-fit"
          >
            <PlusIcon className="size-4" />
            Agregar ítem
          </Button>
        </div>

        {/* ── Descuento ── */}
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={discountEnabled}
              onChange={(e) => setDiscountEnabled(e.target.checked)}
              className="size-4 rounded border-border"
            />
            <span className="font-medium">Aplicar descuento</span>
          </label>
          {discountEnabled ? (
            <div className="flex items-center gap-2 pl-6">
              <Select
                value={discountType}
                onValueChange={(v) => v && setDiscountType(v as "percentage" | "fixed")}
              >
                <SelectTrigger className="w-36">
                  <SelectValue>{(v: string | null) => (v === "percentage" ? "Porcentaje" : "Fijo")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                  <SelectItem value="fixed">Monto fijo</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "10" : "100"}
                className="w-28 tabular-nums"
              />
              {discountAmt > 0 ? (
                <span className="text-sm text-muted-foreground">
                  = -{fmt(currency, discountAmt)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ── Upfront ── */}
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={upfrontEnabled}
              onChange={(e) => setUpfrontEnabled(e.target.checked)}
              className="size-4 rounded border-border"
            />
            <span className="font-medium">Pago inicial (upfront)</span>
          </label>
          {upfrontEnabled ? (
            <div className="flex items-center gap-2 pl-6">
              <Input
                type="number"
                min={1}
                max={100}
                step="1"
                value={upfrontPct}
                onChange={(e) => setUpfrontPct(e.target.value)}
                className="w-24 tabular-nums"
              />
              <span className="text-sm text-muted-foreground">%</span>
              {upfrontAmt > 0 ? (
                <span className="text-sm text-muted-foreground">
                  = -{fmt(currency, upfrontAmt)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ── Notas ── */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="inv-notes">Notas <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
          <textarea
            id="inv-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="flex min-h-[5rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            placeholder="Condiciones, términos, o cualquier nota extra…"
          />
        </div>

        {/* ── Preview de totales ── */}
        <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums font-medium">{fmt(currency, subtotal)}</span>
          </div>
          {discountEnabled && discountAmt > 0 ? (
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-muted-foreground">
                Descuento{discountType === "percentage" ? ` (${discountValue}%)` : ""}
              </span>
              <span className="tabular-nums font-medium text-destructive">
                -{fmt(currency, discountAmt)}
              </span>
            </div>
          ) : null}
          {upfrontEnabled && upfrontAmt > 0 ? (
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-muted-foreground">
                Upfront ({upfrontPct}%)
              </span>
              <span className="tabular-nums font-medium text-destructive">
                -{fmt(currency, upfrontAmt)}
              </span>
            </div>
          ) : null}
          <div className="mt-2 flex justify-between gap-3 border-t border-border/50 pt-2">
            <span className="font-semibold">Total (Balance Due)</span>
            <span className="tabular-nums font-bold">{fmt(currency, total)}</span>
          </div>
        </div>

      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Generando…" : "Generar factura"}
        </Button>
      </DialogFooter>
    </form>
  );
}
