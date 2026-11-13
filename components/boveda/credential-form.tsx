"use client";

import { useState, useTransition } from "react";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCredential, updateCredential } from "@/lib/vault/actions";
import { generatePassword } from "@/lib/vault/password";
import {
  CREDENTIAL_KINDS,
  KIND_LABEL,
  PRESETS,
  type CredentialKind,
} from "@/lib/vault/presets";
import type { CredentialWithAccess } from "@/lib/vault/queries";

export type VaultUser = { id: string; name: string; hasVaultTab: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  /** null = crear una nueva */
  credential: CredentialWithAccess | null;
  users: VaultUser[];
};

export function CredentialFormDialog({ open, onClose, credential, users }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {open ? (
          <FormBody key={credential?.id ?? "new"} credential={credential} users={users} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormBody({
  credential,
  users,
  onClose,
}: {
  credential: CredentialWithAccess | null;
  users: VaultUser[];
  onClose: () => void;
}) {
  const isNew = credential == null;
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<CredentialKind>(credential?.kind ?? "frameio");
  const [name, setName] = useState(credential?.name ?? KIND_LABEL.frameio);
  const [username, setUsername] = useState(credential?.username ?? "");
  const [password, setPassword] = useState("");
  const [loginUrl, setLoginUrl] = useState(credential?.loginUrl ?? PRESETS.frameio.loginUrl ?? "");
  const [changeUrl, setChangeUrl] = useState(
    credential?.changePasswordUrl ?? PRESETS.frameio.changePasswordUrl ?? ""
  );
  const [notes, setNotes] = useState(credential?.notes ?? "");
  const [userIds, setUserIds] = useState<string[]>(credential?.userIds ?? []);

  function changeKind(next: CredentialKind) {
    setKind(next);
    // Al crear, los links y el nombre siguen al tipo elegido.
    if (isNew) {
      setName(next === "otro" ? "" : KIND_LABEL[next]);
      setLoginUrl(PRESETS[next].loginUrl ?? "");
      setChangeUrl(PRESETS[next].changePasswordUrl ?? "");
    }
  }

  function toggleUser(id: string) {
    setUserIds((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const base = {
      name,
      kind,
      username: username || null,
      loginUrl: loginUrl || null,
      changePasswordUrl: changeUrl || null,
      notes: notes || null,
      userIds,
    };
    startTransition(async () => {
      const res = isNew
        ? await createCredential({ ...base, password })
        : await updateCredential(credential.id, base);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isNew ? "Credencial guardada" : "Cambios guardados");
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isNew ? "Nueva credencial" : `Editar ${credential.name}`}</DialogTitle>
        <DialogDescription>
          {isNew
            ? "La contraseña se guarda cifrada. Solo la ven las personas que marques abajo."
            : "Para cambiar la contraseña usá «Rotar», así se avisa a quien corresponde."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cred-kind">Servicio</Label>
            <select
              id="cred-kind"
              value={kind}
              onChange={(e) => changeKind(e.target.value as CredentialKind)}
              className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm"
              disabled={pending}
            >
              {CREDENTIAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cred-name">Nombre</Label>
            <Input
              id="cred-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Gmail compartido"
              disabled={pending}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cred-user">Usuario / email de la cuenta</Label>
          <Input
            id="cred-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="cuenta@gmail.com"
            disabled={pending}
          />
        </div>

        {isNew ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cred-pass">Contraseña actual de la cuenta</Label>
            <div className="flex gap-2">
              <Input
                id="cred-pass"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
                autoComplete="off"
                disabled={pending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(generatePassword())}
                title="Generar una contraseña nueva"
              >
                <RefreshCwIcon />
                Generar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Si la cuenta ya existe, pegá la contraseña que usa hoy. «Generar» es
              para cuentas nuevas.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cred-login">Link para entrar</Label>
            <Input
              id="cred-login"
              type="url"
              value={loginUrl}
              onChange={(e) => setLoginUrl(e.target.value)}
              placeholder="https://"
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cred-change">Link para cambiar la contraseña</Label>
            <Input
              id="cred-change"
              type="url"
              value={changeUrl}
              onChange={(e) => setChangeUrl(e.target.value)}
              placeholder="https://"
              disabled={pending}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cred-notes">Notas</Label>
          <Textarea
            id="cred-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: no conectar con Adobe. Usar solo para subir cortes."
            rows={2}
            disabled={pending}
          />
        </div>

        <fieldset className="flex flex-col gap-2" disabled={pending}>
          <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Quién la puede ver
          </legend>
          {users.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay usuarios todavía. Crealos en Usuarios.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {users.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-[#FFAC37]"
                    checked={userIds.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                  />
                  {u.name}
                  {!u.hasVaultTab && userIds.includes(u.id) ? (
                    <span className="text-xs text-[#FFAC37]">
                      (no tiene la pestaña Bóveda: dásela en Usuarios)
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : isNew ? "Guardar credencial" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </>
  );
}
