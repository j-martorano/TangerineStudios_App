"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import type { EditorPaymentMethod } from "@/lib/payment-methods/queries";

/**
 * Chips de métodos de pago de un editor. Al clickear uno se copia al
 * portapapeles toda la info guardada de ESE método.
 */
export function PaymentMethodChips({
  methods,
}: {
  methods: EditorPaymentMethod[];
}) {
  if (methods.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  async function copy(method: EditorPaymentMethod) {
    if (!method.info) {
      toast.error(`«${method.name}» no tiene info guardada`);
      return;
    }
    try {
      await navigator.clipboard.writeText(method.info);
      toast.success(`Info de «${method.name}» copiada al portapapeles`);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {methods.map((method) => (
        <button
          key={method.method_id}
          type="button"
          onClick={() => copy(method)}
          title={
            method.info
              ? `Copiar info de ${method.name}`
              : `${method.name} — sin info guardada`
          }
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs transition-colors hover:bg-secondary/70"
        >
          {method.name}
          <CopyIcon className="size-3 opacity-60" />
        </button>
      ))}
    </div>
  );
}
