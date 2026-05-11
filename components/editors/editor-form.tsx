"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

import { MultiCombobox } from "@/components/ui/multi-combobox";

import { createEditor, updateEditor } from "@/lib/editors/actions";
import { createClient } from "@/lib/clients/actions";
import type { ClientMini, EditorRow } from "@/lib/projects/types";

type Props = {
  mode: "create" | "edit";
  editor?: EditorRow & { clients?: ClientMini[] };
  availableClients: ClientMini[];
  onSuccess?: () => void;
};

export function EditorForm({
  mode,
  editor,
  availableClients,
  onSuccess,
}: Props) {
  const [name, setName] = useState(editor?.name ?? "");
  const [email, setEmail] = useState(editor?.email ?? "");
  const [phone, setPhone] = useState(editor?.phone ?? "");
  const [discordId, setDiscordId] = useState(editor?.discord_id ?? "");
  const [bankInfo, setBankInfo] = useState(editor?.bank_info ?? "");
  const [docsUrl, setDocsUrl] = useState(editor?.docs_url ?? "");
  const [clientIds, setClientIds] = useState<string[]>(
    editor?.clients?.map((c) => c.id) ?? []
  );
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("El nombre es obligatorio");
      return;
    }

    const payload = {
      name: trimmed,
      email: email.trim() || null,
      phone: phone.trim() || null,
      discord_id: discordId.trim() || null,
      bank_info: bankInfo.trim() || null,
      docs_url: docsUrl.trim() || null,
      client_ids: clientIds,
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="lucia@example.com"
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
          label="Clientes asignados"
          hint="Si no aparece el cliente en la lista, escribilo y elegí «Crear»."
        >
          <MultiCombobox
            items={availableClients}
            selected={clientIds}
            onChange={setClientIds}
            placeholder="Sin clientes asignados"
            emptyText="No hay clientes cargados"
            onCreate={async (name) => {
              const result = await createClient({ name });
              return result.ok ? result.client : null;
            }}
            renderTag={(c) => (
              <span className="flex items-center gap-1">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </span>
            )}
            renderOption={(c) => (
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </span>
            )}
          />
        </Field>
      </Section>

      <Section title="Datos administrativos">
        <Field
          label="Datos bancarios"
          hint="CBU/CVU, alias, cuenta o ID equivalente para transferencias."
        >
          <Textarea
            rows={3}
            value={bankInfo}
            onChange={(e) => setBankInfo(e.target.value)}
            placeholder="Banco — CBU 0000…0000 — Alias mi.alias.mp"
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
