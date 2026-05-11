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
import { ClientCombobox } from "@/components/clients/client-combobox";

import { CURRENCIES, PROJECT_STATUSES } from "@/lib/projects/types";
import type {
  ClientMini,
  CurrencyCode,
  EditorMini,
  ProjectStatus,
  ProjectWithRelations,
} from "@/lib/projects/types";
import { CURRENCY_LABEL, STATUS_LABEL } from "@/lib/projects/format";
import { createProject, updateProject } from "@/lib/projects/actions";

const NO_EDITOR = "__none__";

type Props = {
  mode: "create" | "edit";
  editors: EditorMini[];
  clients: ClientMini[];
  project?: ProjectWithRelations;
  onSuccess?: () => void;
};

export function ProjectForm({
  mode,
  editors,
  clients,
  project,
  onSuccess,
}: Props) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [clientId, setClientId] = useState<string | null>(
    project?.client?.id ?? null
  );
  const [status, setStatus] = useState<ProjectStatus>(
    project?.status ?? "pending"
  );
  const [price, setPrice] = useState<string>(
    project?.price != null ? String(project.price) : ""
  );
  const [currency, setCurrency] = useState<CurrencyCode>(
    project?.currency ?? "ARS"
  );
  const [editorId, setEditorId] = useState<string>(
    project?.editor?.id ?? NO_EDITOR
  );
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      toast.error("El título es obligatorio");
      return;
    }

    const parsedPrice = price === "" ? null : Number(price);
    if (parsedPrice !== null && Number.isNaN(parsedPrice)) {
      toast.error("Precio inválido");
      return;
    }

    const payload = {
      title: trimmedTitle,
      client_id: clientId,
      status,
      price: parsedPrice,
      currency,
      editor_id: editorId === NO_EDITOR ? null : editorId,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createProject(payload)
          : await updateProject(project!.id, payload);

      if (result.ok) {
        toast.success(
          mode === "create" ? "Proyecto creado" : "Cambios guardados"
        );
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  const editorById = new Map(editors.map((ed) => [ed.id, ed.name]));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">
          Título <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
          placeholder="Reel demo 2026 — Acme"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Cliente</Label>
        <ClientCombobox
          clients={clients}
          value={clientId}
          onChange={(id) => setClientId(id)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Estado</Label>
          <Select
            value={status}
            onValueChange={(v) => v && setStatus(v as ProjectStatus)}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue>
                {(v: string | null) =>
                  v ? STATUS_LABEL[v as ProjectStatus] : ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Precio</Label>
          <Input
            id="price"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="currency">Moneda</Label>
          <Select
            value={currency}
            onValueChange={(v) => v && setCurrency(v as CurrencyCode)}
          >
            <SelectTrigger id="currency" className="w-full">
              <SelectValue>
                {(v: string | null) => (v ? v : "")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CURRENCY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="editor_id">Editor</Label>
        <Select
          value={editorId}
          onValueChange={(v) => setEditorId(v ?? NO_EDITOR)}
        >
          <SelectTrigger id="editor_id" className="w-full">
            <SelectValue>
              {(v: string | null) => {
                if (!v || v === NO_EDITOR) return "Sin asignar";
                return editorById.get(v) ?? "—";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_EDITOR}>Sin asignar</SelectItem>
            {editors.map((ed) => (
              <SelectItem key={ed.id} value={ed.id}>
                {ed.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Guardando…"
            : mode === "create"
              ? "Crear proyecto"
              : "Guardar cambios"}
        </Button>
      </DialogFooter>
    </form>
  );
}
