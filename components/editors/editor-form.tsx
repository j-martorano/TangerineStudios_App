"use client";

import { useState, useTransition } from "react";
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

import {
  EditorPaymentMethods,
  type EditorMethodValue,
} from "./editor-payment-methods";
import {
  EditorTiersEditor,
  type TierDraft,
} from "./editor-tiers-editor";
import {
  EditorClientPairs,
  type ClientPairDraft,
} from "./editor-client-pairs";

import { ContactLinksEditor } from "@/components/ui/contact-links-editor";
import { createEditor, updateEditor } from "@/lib/editors/actions";
import {
  EDITOR_PAYMENT_TYPES,
  EDITOR_PAYMENT_TYPE_LABEL,
} from "@/lib/projects/types";
import type {
  ClientEditorPair,
  ClientMini,
  ContactLink,
  EditorPaymentType,
  EditorRow,
  PaymentTier,
} from "@/lib/projects/types";
import type {
  EditorPaymentMethod,
  PaymentMethod,
} from "@/lib/payment-methods/queries";

type Props = {
  mode: "create" | "edit";
  editor?: EditorRow & {
    clients?: ClientMini[];
    client_pairs?: ClientEditorPair[];
    payment_methods?: EditorPaymentMethod[];
    tiers?: PaymentTier[];
  };
  availableClients: ClientMini[];
  paymentMethodsCatalog: PaymentMethod[];
  onSuccess?: () => void;
};

export function EditorForm({
  mode,
  editor,
  availableClients,
  paymentMethodsCatalog,
  onSuccess,
}: Props) {
  const [name, setName] = useState(editor?.name ?? "");
  const [contactLinks, setContactLinks] = useState<ContactLink[]>(
    () => (editor?.contact_links as ContactLink[] | null) ?? []
  );
  const [discordId, setDiscordId] = useState(editor?.discord_id ?? "");
  const [methods, setMethods] = useState<EditorMethodValue[]>(
    () =>
      editor?.payment_methods?.map((pm) => ({
        method_id: pm.method_id,
        name: pm.name,
        info: pm.info ?? "",
      })) ?? []
  );
  const [docsUrl, setDocsUrl] = useState(editor?.docs_url ?? "");
  const [paymentType, setPaymentType] = useState<EditorPaymentType>(
    editor?.payment_type ?? "por_minuto"
  );
  const [rate, setRate] = useState<string>(
    editor?.rate != null ? String(editor.rate) : ""
  );
  const [flatAmount, setFlatAmount] = useState<string>(
    editor?.flat_amount != null ? String(editor.flat_amount) : ""
  );
  const [tiers, setTiers] = useState<TierDraft[]>(
    () =>
      editor?.tiers?.map((t) => ({
        min: String(t.min_minutes),
        max: String(t.max_minutes),
        amount: String(t.amount),
      })) ?? []
  );
  const [clientPairs, setClientPairs] = useState<ClientPairDraft[]>(
    () =>
      editor?.client_pairs?.map((p) => ({
        client_id: p.client.id,
        payment_type: p.payment_type,
        rate: p.rate != null ? String(p.rate) : "",
        flat_amount: p.flat_amount != null ? String(p.flat_amount) : "",
        tiers: p.tiers.map((t) => ({
          min: String(t.min_minutes),
          max: String(t.max_minutes),
          amount: String(t.amount),
        })),
      })) ?? []
  );
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("El nombre es obligatorio");
      return;
    }

    const parsedRate = rate === "" ? null : Number(rate);
    if (parsedRate !== null && Number.isNaN(parsedRate)) {
      toast.error("Rate por minuto inválido");
      return;
    }
    const parsedFlat = flatAmount === "" ? null : Number(flatAmount);
    if (parsedFlat !== null && Number.isNaN(parsedFlat)) {
      toast.error("Monto FLAT inválido");
      return;
    }

    let parsedTiers:
      | { min_minutes: number; max_minutes: number; amount: number }[]
      | undefined;
    if (paymentType === "flat_variable") {
      if (tiers.length === 0) {
        toast.error("Agregá al menos un tramo de minutos");
        return;
      }
      parsedTiers = [];
      for (const t of tiers) {
        const min = Number(t.min);
        const max = Number(t.max);
        const amount = Number(t.amount);
        if (
          t.min === "" ||
          t.max === "" ||
          t.amount === "" ||
          Number.isNaN(min) ||
          Number.isNaN(max) ||
          Number.isNaN(amount)
        ) {
          toast.error("Completá todos los campos de cada tramo");
          return;
        }
        if (max <= min) {
          toast.error("En cada tramo, «Hasta» debe ser mayor que «Desde»");
          return;
        }
        parsedTiers.push({ min_minutes: min, max_minutes: max, amount });
      }
    }

    // Parsear los pares cliente-editor y validar.
    const parsedPairs: {
      client_id: string;
      payment_type: EditorPaymentType | null;
      rate: number | null;
      flat_amount: number | null;
      tiers?: { min_minutes: number; max_minutes: number; amount: number }[];
    }[] = [];
    for (const pair of clientPairs) {
      const pp = pair.payment_type;
      let pairRate: number | null = null;
      let pairFlat: number | null = null;
      let pairTiers:
        | { min_minutes: number; max_minutes: number; amount: number }[]
        | undefined;

      if (pp === "por_minuto") {
        if (pair.rate === "") {
          toast.error("Cargá el rate por minuto para todos los clientes con ese modelo");
          return;
        }
        const n = Number(pair.rate);
        if (Number.isNaN(n) || n < 0) {
          toast.error("Rate por minuto inválido en uno de los clientes");
          return;
        }
        pairRate = n;
      } else if (pp === "flat") {
        if (pair.flat_amount === "") {
          toast.error("Cargá el monto FLAT para todos los clientes con ese modelo");
          return;
        }
        const n = Number(pair.flat_amount);
        if (Number.isNaN(n) || n < 0) {
          toast.error("Monto FLAT inválido en uno de los clientes");
          return;
        }
        pairFlat = n;
      } else if (pp === "flat_variable") {
        if (pair.tiers.length === 0) {
          toast.error("Agregá al menos un tramo para FLAT variable en cada cliente");
          return;
        }
        pairTiers = [];
        for (const t of pair.tiers) {
          const min = Number(t.min);
          const max = Number(t.max);
          const amount = Number(t.amount);
          if (
            t.min === "" || t.max === "" || t.amount === "" ||
            Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(amount)
          ) {
            toast.error("Completá todos los campos de cada tramo");
            return;
          }
          if (max <= min) {
            toast.error("En cada tramo «Hasta» debe ser mayor que «Desde»");
            return;
          }
          pairTiers.push({ min_minutes: min, max_minutes: max, amount });
        }
      }

      parsedPairs.push({
        client_id: pair.client_id,
        payment_type: pp,
        rate: pairRate,
        flat_amount: pairFlat,
        tiers: pairTiers,
      });
    }

    const payload = {
      name: trimmed,
      contact_links: contactLinks.filter((l) => l.value.trim()),
      discord_id: discordId.trim() || null,
      docs_url: docsUrl.trim() || null,
      payment_type: paymentType,
      rate: paymentType === "por_minuto" ? parsedRate : null,
      flat_amount: paymentType === "flat" ? parsedFlat : null,
      tiers: parsedTiers,
      client_pairs: parsedPairs,
      payment_methods: methods.map((m) => ({
        method_id: m.method_id,
        info: m.info.trim() || null,
      })),
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createEditor(payload)
          : await updateEditor(editor!.id, payload);
      if (result.ok) {
        toast.success(
          mode === "create" ? "Editor creado" : "Cambios guardados"
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
            placeholder="Lucía Méndez"
            autoFocus
          />
        </Field>

        <Field label="Contacto">
          <ContactLinksEditor value={contactLinks} onChange={setContactLinks} />
        </Field>

        <Field
          label="Discord ID"
          hint="ID numérico de Discord (lo necesita el bot para asociar el comando /done con este editor)."
        >
          <Input
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="298745632100000001"
          />
        </Field>

        <Field
          label="Tipo de pago"
          hint="Define cómo se calcula su costo en los proyectos."
        >
          <Select
            value={paymentType}
            onValueChange={(v) => v && setPaymentType(v as EditorPaymentType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string | null) =>
                  v ? EDITOR_PAYMENT_TYPE_LABEL[v as EditorPaymentType] : ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EDITOR_PAYMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {EDITOR_PAYMENT_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {paymentType === "por_minuto" ? (
          <Field
            label="Rate por minuto"
            hint="Monto en USD por cada minuto final de video. Costo = rate × duración."
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0"
            />
          </Field>
        ) : null}

        {paymentType === "flat" ? (
          <Field
            label="Monto FLAT"
            hint="Monto fijo en USD por proyecto, sin importar la duración del video."
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={flatAmount}
              onChange={(e) => setFlatAmount(e.target.value)}
              placeholder="0"
            />
          </Field>
        ) : null}

        {paymentType === "flat_variable" ? (
          <Field
            label="Tramos de minutos"
            hint="Cada tramo paga un monto fijo. El video toma el tramo en el que cae su duración (el inicio del rango se incluye); si queda fuera de todos, usa el más cercano."
          >
            <EditorTiersEditor value={tiers} onChange={setTiers} />
          </Field>
        ) : null}

        <Field
          label="Clientes asignados"
          hint="Cada cliente puede tener su propia config de pago para este editor. Si dejás «Usar el global», se aplica el modelo del editor."
        >
          <EditorClientPairs
            availableClients={availableClients}
            value={clientPairs}
            onChange={setClientPairs}
          />
        </Field>
      </Section>

      <Section title="Datos administrativos">
        <Field
          label="Métodos de pago"
          hint="Un chip por método (Binance, DolarApp, banco…). Escribí para buscar o crear uno nuevo, y guardá la info de cada uno."
        >
          <EditorPaymentMethods
            catalog={paymentMethodsCatalog}
            value={methods}
            onChange={setMethods}
          />
        </Field>

        <Field
          label="Documentos"
          hint="URL a carpeta o archivo (Drive, Dropbox, etc.) con NDA / contrato."
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
              ? "Crear editor"
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
