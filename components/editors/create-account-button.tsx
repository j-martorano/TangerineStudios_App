"use client";

import { useState, useTransition } from "react";
import { UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserPermissionsForm,
  type PermissionsValue,
} from "@/components/usuarios/user-permissions-form";
import {
  TempPasswordDialog,
  type TempPassword,
} from "@/components/usuarios/temp-password-dialog";
import { createUser } from "@/lib/users/actions";
import type { ContactLink } from "@/lib/projects/types";

type Props = {
  editor: { id: string; name: string; contact_links: unknown };
  credentials: { id: string; name: string }[];
  appUrl: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * «Crear usuario» desde la fila de un editor que todavía no tiene cuenta.
 * Es el mismo formulario de Usuarios, con el nombre (y el email, si figura en
 * sus contactos) ya cargados y el vínculo con la ficha hecho.
 */
export function CreateAccountButton({ editor, credentials, appUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [temp, setTemp] = useState<TempPassword | null>(null);

  const emailGuess =
    ((editor.contact_links as ContactLink[] | null) ?? [])
      .map((l) => l.value?.trim() ?? "")
      .find((v) => EMAIL_RE.test(v)) ?? "";

  function handleCreate(v: PermissionsValue) {
    startTransition(async () => {
      const res = await createUser({
        email: v.email,
        displayName: v.displayName || null,
        role: v.role,
        tabs: v.tabs,
        credentialIds: v.credentialIds,
        editorId: editor.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      if (res.data.warning) toast.warning(res.data.warning, { duration: 15000 });
      setTemp({ email: v.email, password: res.data.tempPassword, isNew: true });
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlusIcon />
        Crear usuario
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cuenta para {editor.name}</DialogTitle>
            <DialogDescription>
              Se crea con una contraseña temporal que vas a ver una sola vez y
              queda vinculada a esta ficha.
            </DialogDescription>
          </DialogHeader>
          <UserPermissionsForm
            mode="create"
            initial={{
              email: emailGuess,
              displayName: editor.name,
              role: "member",
              tabs: [],
              credentialIds: [],
              editorId: editor.id,
            }}
            credentials={credentials}
            editors={[{ id: editor.id, name: editor.name, userId: null, disabledAt: null }]}
            lockEditor
            pending={pending}
            submitLabel="Crear usuario"
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      <TempPasswordDialog result={temp} appUrl={appUrl} onClose={() => setTemp(null)} />
    </>
  );
}
