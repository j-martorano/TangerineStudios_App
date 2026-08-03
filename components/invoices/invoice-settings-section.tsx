"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

import { updateInvoiceSettings } from "@/lib/invoices/actions";
import type { InvoiceSettings } from "@/lib/invoices/types";

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  settings: InvoiceSettings;
};

// ── Componente ────────────────────────────────────────────────────────────────

export function InvoiceSettingsSection({ settings }: Props) {
  const [pending, startTransition] = useTransition();

  const [nextNumber, setNextNumber] = useState(String(settings.next_number));
  const [senderName, setSenderName] = useState(settings.sender_name);
  const [senderAddress, setSenderAddress] = useState(settings.sender_address);
  const [senderCity, setSenderCity] = useState(settings.sender_city);
  const [senderState, setSenderState] = useState(settings.sender_state);
  const [senderCountry, setSenderCountry] = useState(settings.sender_country);
  const [senderEmail, setSenderEmail] = useState(settings.sender_email);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const n = parseInt(nextNumber, 10);
    if (!n || n < 1) {
      toast.error("El número de próxima factura debe ser un entero positivo");
      return;
    }
    if (!senderName.trim()) {
      toast.error("El nombre del emisor es obligatorio");
      return;
    }

    startTransition(async () => {
      const result = await updateInvoiceSettings({
        next_number: n,
        sender_name: senderName.trim(),
        sender_address: senderAddress.trim(),
        sender_city: senderCity.trim(),
        sender_state: senderState.trim(),
        sender_country: senderCountry.trim(),
        sender_email: senderEmail.trim(),
      });

      if (result.ok) {
        toast.success("Configuración de facturación guardada");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {/* Próxima factura */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-next-number">
              Próximo número de factura
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{"{CLIENTE}-INV"}</span>
              <Input
                id="inv-next-number"
                type="number"
                min={1}
                step={1}
                value={nextNumber}
                onChange={(e) => setNextNumber(e.target.value)}
                className="w-28 tabular-nums"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Las facturas se numeran automáticamente a partir de este valor.
              Solo modificarlo si necesitás reanudar desde un número específico.
            </p>
          </div>

          <hr className="border-border/40" />

          {/* Datos del emisor */}
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Datos del emisor (aparecen en el PDF)
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="inv-sender-name">
                Nombre / Razón social <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inv-sender-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Nombre completo o empresa"
                required
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="inv-sender-address">Dirección</Label>
              <Input
                id="inv-sender-address"
                value={senderAddress}
                onChange={(e) => setSenderAddress(e.target.value)}
                placeholder="Calle y número"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-sender-city">Ciudad / CP</Label>
              <Input
                id="inv-sender-city"
                value={senderCity}
                onChange={(e) => setSenderCity(e.target.value)}
                placeholder="1876 Quilmes Oeste"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-sender-state">Provincia / Estado</Label>
              <Input
                id="inv-sender-state"
                value={senderState}
                onChange={(e) => setSenderState(e.target.value)}
                placeholder="Buenos Aires"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-sender-country">País</Label>
              <Input
                id="inv-sender-country"
                value={senderCountry}
                onChange={(e) => setSenderCountry(e.target.value)}
                placeholder="Argentina"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="inv-sender-email">Email</Label>
              <Input
                id="inv-sender-email"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="hola@ejemplo.com"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar configuración"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
