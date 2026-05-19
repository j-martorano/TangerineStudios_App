"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

import { MultiCombobox } from "@/components/ui/multi-combobox";
import { ClientPaymentsSection } from "./client-payments-section";

import { createClient, updateClient } from "@/lib/clients/actions";
import { createEditor } from "@/lib/editors/actions";
import { contrastColor, randomClientColor } from "@/lib/clients/palette";
import { PAYMENT_TYPES, PAYMENT_TYPE_LABEL } from "@/lib/projects/types";
import type {
  ClientPayment,
  ClientRow,
  EditorMini,
  PaymentType,
} from "@/lib/projects/types";

type Props = {
  mode: "create" | "edit";
  client?: ClientRow & {
    editors?: EditorMini[];
    minute_balance?: number | null;
    payments?: ClientPayment[];
  };
  availableEditors: EditorMini[];
  onSuccess?: () => void;
};

export function ClientForm({
  mode,
  client,
  availableEditors,
  onSuccess,
}: Props) {
  const [name, setName] = useState(client?.name ?? "");
  const [color, setColor] = useState(client?.color ?? randomClientColor());
  const [paymentType, setPaymentType] = useState<PaymentType>(
    client?.payment_type ?? "por_proyecto"
  );
  const [agreedPrice, setAgreedPrice] = useState<string>(
    client?.agreed_price != null ? String(client.agreed_price) : ""
  );
  const [retainerDiscount, setRetainerDiscount] = useState<string>(
    client?.retainer_discount_pct != null
      ? String(client.retainer_discount_pct)
      : "10"
  );
  const [billingInfo, setBillingInfo] = useState(client?.billing_info ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [docsUrl, setDocsUrl] = useState(client?.docs_url ?? "");
  const [editorIds, setEditorIds] = useState<string[]>(
    client?.editors?.map((e) => e.id) ?? []
  );
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("El nombre es obligatorio");
      return;
    }

    const parsedPrice = agreedPrice === "" ? null : Number(agreedPrice);
    if (parsedPrice !== null && Number.isNaN(parsedPrice)) {
      toast.error("Rate inválido");
      return;
    }

    const parsedDiscount =
      retainerDiscount === "" ? 10 : Number(retainerDiscount);
    if (
      Number.isNaN(parsedDiscount) ||
      parsedDiscount < 0 ||
      parsedDiscount > 100
    ) {
      toast.error("El descuento de retainer debe ser entre 0 y 100%");
      return;
    }

    const usesRate = paymentType === "por_rate" || paymentType === "mensual";
    const payload = {
      name: trimmed,
      color,
      payment_type: paymentType,
      agreed_price: usesRate ? parsedPrice : null,
      retainer_discount_pct: parsedDiscount,
      billing_info: billingInfo.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      docs_url: docsUrl.trim() || null,
      editor_ids: editorIds,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClient(payload)
          : await updateClient(client!.id, payload);
      if (result.ok) {
        toast.success(
          mode === "create" ? "Cliente creado" : "Cambios guardados"
        );
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
      <Section title="Datos operativos">
        <Field label="Nombre" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            placeholder="Acme S.A."
            autoFocus
          />
        </Field>

        <Field
          label="Color de identificación"
          hint="Generado al azar al crear. Podés regenerar o elegir uno con el picker."
        >
          <div className="flex items-center gap-3">
            <label
              className="flex h-10 w-16 cursor-pointer items-center justify-center rounded-md ring-1 ring-foreground/15 transition-transform hover:scale-105"
              style={{ backgroundColor: color, color: contrastColor(color) }}
            >
              <span className="font-mono text-xs">{color}</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="sr-only"
                aria-label="Elegir color manualmente"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setColor(randomClientColor())}
            >
              <RefreshCwIcon className="size-3.5" />
              Regenerar
            </Button>
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Tipo de pago"
            hint="Define cómo se calcula el precio de cada proyecto."
          >
            <Select
              value={paymentType}
              onValueChange={(v) => v && setPaymentType(v as PaymentType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v ? PAYMENT_TYPE_LABEL[v as PaymentType] : ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PAYMENT_TYPE_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {paymentType === "por_rate" || paymentType === "mensual" ? (
            <Field
              label="Rate por minuto"
              hint="Lo que cobramos por minuto de video editado."
            >
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(e.target.value)}
                placeholder="0"
              />
            </Field>
          ) : (
            <Field
              label="Precio por proyecto"
              hint="Se carga manualmente en cada proyecto al crearlo."
            >
              <Input disabled placeholder="Manual al crear el proyecto" />
            </Field>
          )}
        </div>

        {paymentType === "mensual" ? (
          <>
            <Field
              label="Descuento de retainer (%)"
              hint="Descuento sobre el rate por ser cliente mensual (retainer). Default 10%."
            >
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="1"
                value={retainerDiscount}
                onChange={(e) => setRetainerDiscount(e.target.value)}
                placeholder="10"
              />
            </Field>

            {mode === "edit" && client ? (
              <Field
                label="Pagos y saldo de minutos"
                hint={
                  client.minute_balance != null
                    ? `Saldo de minutos actual: ${client.minute_balance} min`
                    : "Registrá pagos para acreditar minutos."
                }
              >
                <ClientPaymentsSection
                  clientId={client.id}
                  rate={client.agreed_price}
                  discountPct={client.retainer_discount_pct}
                  payments={client.payments ?? []}
                />
              </Field>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Guardá el cliente para registrar pagos.
              </p>
            )}
          </>
        ) : null}

        <Field
          label="Editores asignados"
          hint="Si no aparece el editor en la lista, escribilo y elegí «Crear»."
        >
          <MultiCombobox
            items={availableEditors}
            selected={editorIds}
            onChange={setEditorIds}
            placeholder="Sin editores asignados"
            emptyText="No hay editores cargados"
            onCreate={async (name) => {
              const result = await createEditor({ name });
              return result.ok ? result.editor : null;
            }}
          />
        </Field>
      </Section>

      <Section title="Datos administrativos">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contacto@acme.com"
            />
          </Field>
          <Field label="Teléfono / WhatsApp">
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 11 5555-5555"
            />
          </Field>
        </div>

        <Field
          label="Datos de facturación"
          hint="Texto libre: CUIT, razón social, dirección, condición IVA, etc."
        >
          <Textarea
            rows={3}
            value={billingInfo}
            onChange={(e) => setBillingInfo(e.target.value)}
            placeholder="CUIT 30-12345678-9 — Acme S.A. — Av. Siempre Viva 123"
          />
        </Field>

        <Field
          label="Documentos"
          hint="URL a carpeta o archivo (Drive, Dropbox, etc.)"
        >
          <Input
            type="url"
            value={docsUrl}
            onChange={(e) => setDocsUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
        </Field>
      </Section>
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Guardando…"
            : mode === "create"
              ? "Crear cliente"
              : "Guardar cambios"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
