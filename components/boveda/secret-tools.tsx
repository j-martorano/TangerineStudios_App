"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Copia texto al portapapeles con feedback. */
export function CopyButton({
  value,
  label = "Copiar",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={className}
      aria-label={label}
    >
      {copied ? <CheckIcon className="text-[#37FF62]" /> : <CopyIcon />}
      {copied ? "Copiado" : label}
    </Button>
  );
}

/** Contraseña en monoespaciado, lista para copiar. */
export function SecretValue({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <code className="min-w-0 flex-1 break-all rounded-md border border-white/[0.08] bg-black/40 px-3 py-2 font-mono text-sm tracking-wide">
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  );
}
