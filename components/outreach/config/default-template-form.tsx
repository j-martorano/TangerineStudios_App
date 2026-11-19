"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateDefaultTemplate } from "@/lib/outreach/actions";

export function DefaultTemplateForm({ template }: { template: string }) {
  const router = useRouter();
  const [value, setValue] = useState(template);
  const [pending, startTransition] = useTransition();
  const dirty = value !== template;

  function save() {
    startTransition(async () => {
      const res = await updateDefaultTemplate(value);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Plantilla guardada");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        className="min-h-56 leading-relaxed"
        placeholder="Escribí el mensaje base. Usá {PAGINAS} y {SAMPLES} donde quieras que vayan los links."
      />
      <div className="flex items-center justify-end gap-2">
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={() => setValue(template)} disabled={pending}>
            Descartar
          </Button>
        ) : null}
        <Button size="sm" onClick={save} disabled={pending || !dirty}>
          {pending ? "Guardando…" : "Guardar plantilla"}
        </Button>
      </div>
    </div>
  );
}
