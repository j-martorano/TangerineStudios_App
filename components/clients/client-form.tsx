"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

import { createClient, updateClient } from "@/lib/clients/actions";
import type { ClientMini } from "@/lib/projects/types";

type Props = {
  mode: "create" | "edit";
  client?: ClientMini;
  onSuccess?: () => void;
};

export function ClientForm({ mode, client, onSuccess }: Props) {
  const [name, setName] = useState(client?.name ?? "");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("El nombre es obligatorio");
      return;
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClient({ name: trimmed })
          : await updateClient(client!.id, { name: trimmed });

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
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">
          Nombre <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          placeholder="Acme S.A."
          autoFocus
        />
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
