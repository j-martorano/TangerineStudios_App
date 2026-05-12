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

import {
  COBRADO_STATUSES,
  CURRENCIES,
  INVOICED_STATUSES,
  PAGADO_STATUSES,
  PROJECT_PHASES,
} from "@/lib/projects/types";
import type {
  ClientMini,
  CobradoStatus,
  CurrencyCode,
  EditorMini,
  InvoicedStatus,
  PagadoStatus,
  ProjectPhase,
  ProjectWithRelations,
} from "@/lib/projects/types";
import {
  COBRADO_LABEL,
  CURRENCY_LABEL,
  INVOICED_LABEL,
  PAGADO_LABEL,
  PHASE_LABEL,
} from "@/lib/projects/format";
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
  const [phase, setPhase] = useState<ProjectPhase>(
    project?.phase ?? "por_asignar"
  );
  const [cobrado, setCobrado] = useState<CobradoStatus>(
    project?.cobrado ?? "no"
  );
  const [pagado, setPagado] = useState<PagadoStatus>(
    project?.pagado ?? "sin_pagar"
  );
  const [invoiced, setInvoiced] = useState<InvoicedStatus>(
    project?.invoiced ?? "no"
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
      phase,
      cobrado,
      pagado,
      invoiced,
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
      <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
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
            <Label htmlFor="phase">Fase</Label>
            <Select
              value={phase}
              onValueChange={(v) => v && setPhase(v as ProjectPhase)}
            >
              <SelectTrigger id="phase" className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v ? PHASE_LABEL[v as ProjectPhase] : ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PROJECT_PHASES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PHASE_LABEL[p]}
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

        <div className="border-t pt-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Estado de pago
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cobrado">
                Cobrado{" "}
                <span className="text-xs text-muted-foreground">
                  (cliente)
                </span>
              </Label>
              <Select
                value={cobrado}
                onValueChange={(v) => v && setCobrado(v as CobradoStatus)}
              >
                <SelectTrigger id="cobrado" className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? COBRADO_LABEL[v as CobradoStatus] : ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COBRADO_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {COBRADO_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pagado">
                Pagado{" "}
                <span className="text-xs text-muted-foreground">(editor)</span>
              </Label>
              <Select
                value={pagado}
                onValueChange={(v) => v && setPagado(v as PagadoStatus)}
              >
                <SelectTrigger id="pagado" className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? PAGADO_LABEL[v as PagadoStatus] : ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAGADO_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PAGADO_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="invoiced">Facturado</Label>
              <Select
                value={invoiced}
                onValueChange={(v) => v && setInvoiced(v as InvoicedStatus)}
              >
                <SelectTrigger id="invoiced" className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? INVOICED_LABEL[v as InvoicedStatus] : ""
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INVOICED_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {INVOICED_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
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
