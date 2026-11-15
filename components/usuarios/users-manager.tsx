"use client";

import { useState, useTransition } from "react";
import {
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  RotateCcwKeyIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserXIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SecretValue } from "@/components/boveda/secret-tools";
import {
  createUser,
  deleteUser,
  disableUser,
  enableUser,
  resetUserPassword,
  updateUserPermissions,
} from "@/lib/users/actions";
import type { KnownCredential } from "@/lib/vault/events";
import type { AppUser } from "@/lib/users/queries";
import { TABS } from "@/lib/auth/tabs";

import { UserPermissionsForm, type PermissionsValue } from "./user-permissions-form";

type Credential = { id: string; name: string; userIds: string[] };

type Props = {
  users: AppUser[];
  credentials: Credential[];
  currentUserId: string;
  appUrl: string;
};

const DATE = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

type Pending =
  | { kind: "temp"; email: string; password: string; isNew: boolean }
  | { kind: "rotate"; name: string; credentials: KnownCredential[] }
  | null;

export function UsersManager({ users, credentials, currentUserId, appUrl }: Props) {
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [confirm, setConfirm] = useState<{ user: AppUser; action: "disable" | "delete" } | null>(null);
  const [result, setResult] = useState<Pending>(null);

  const credsOf = (userId: string) =>
    credentials.filter((c) => c.userIds.includes(userId));

  function handleCreate(v: PermissionsValue) {
    startTransition(async () => {
      const res = await createUser({
        email: v.email,
        displayName: v.displayName || null,
        role: v.role,
        tabs: v.tabs,
        credentialIds: v.credentialIds,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCreateOpen(false);
      if (res.data.warning) toast.warning(res.data.warning, { duration: 15000 });
      setResult({ kind: "temp", email: v.email, password: res.data.tempPassword, isNew: true });
    });
  }

  function handleUpdate(user: AppUser, v: PermissionsValue) {
    startTransition(async () => {
      const res = await updateUserPermissions(user.id, {
        displayName: v.displayName || null,
        role: v.role,
        tabs: v.tabs,
        credentialIds: v.credentialIds,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Permisos guardados");
      setEditing(null);
      if (res.data.lostCredentials.length > 0) {
        setResult({
          kind: "rotate",
          name: user.displayName ?? user.email,
          credentials: res.data.lostCredentials,
        });
      }
    });
  }

  function handleReset(user: AppUser) {
    startTransition(async () => {
      const res = await resetUserPassword(user.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult({ kind: "temp", email: user.email, password: res.data.tempPassword, isNew: false });
    });
  }

  function handleEnable(user: AppUser) {
    startTransition(async () => {
      const res = await enableUser(user.id);
      if (!res.ok) toast.error(res.error);
      else toast.success(`${user.displayName ?? user.email} puede volver a entrar`);
    });
  }

  function handleConfirm() {
    if (!confirm) return;
    const { user, action } = confirm;
    startTransition(async () => {
      const res = action === "disable" ? await disableUser(user.id) : await deleteUser(user.id);
      setConfirm(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(action === "disable" ? "Usuario deshabilitado" : "Usuario borrado");
      if (res.data.warning) toast.warning(res.data.warning, { duration: 15000 });
      if (res.data.knownCredentials.length > 0) {
        setResult({
          kind: "rotate",
          name: user.displayName ?? user.email,
          credentials: res.data.knownCredentials,
        });
      }
    });
  }

  return (
    <>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} usuario{users.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          Nuevo usuario
        </Button>
      </header>

      <div className="divide-y divide-border/50 rounded-xl border bg-card">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const creds = credsOf(u.id);
          return (
            <div
              key={u.id}
              className={`flex flex-col gap-3 p-4 md:flex-row md:items-center ${
                u.disabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{u.displayName ?? u.email}</span>
                  {u.role === "admin" ? (
                    <Badge className="gap-1">
                      <ShieldCheckIcon className="size-3" />
                      Admin
                    </Badge>
                  ) : null}
                  {isSelf ? <Badge variant="outline">Vos</Badge> : null}
                  {u.disabled ? <Badge variant="destructive">Deshabilitado</Badge> : null}
                </div>
                {u.displayName ? (
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                ) : null}
                <div className="flex flex-wrap gap-1">
                  {u.role === "admin" ? (
                    <span className="text-xs text-muted-foreground">Todas las pestañas</span>
                  ) : u.tabs.length === 0 ? (
                    <span className="text-xs text-[#FF3737]">Sin pestañas: no ve nada</span>
                  ) : (
                    TABS.filter((t) => u.tabs.includes(t.key)).map((t) => (
                      <Badge key={t.key} variant="secondary" className="font-normal">
                        {t.label}
                      </Badge>
                    ))
                  )}
                </div>
                {creds.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <KeyRoundIcon className="size-3 text-primary" />
                    {creds.map((c) => c.name).join(" · ")}
                  </div>
                ) : null}
                <span className="text-[11px] text-muted-foreground/70">
                  {u.lastSignInAt
                    ? `Último ingreso: ${DATE.format(new Date(u.lastSignInAt))}`
                    : "Nunca entró"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing(u)}>
                  <PencilIcon />
                  Permisos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleReset(u)}
                  title="Genera una contraseña temporal nueva"
                >
                  <RotateCcwKeyIcon />
                  Nueva contraseña
                </Button>
                {!isSelf ? (
                  u.disabled ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleEnable(u)}
                      className="text-[#37FF62]"
                    >
                      <PowerIcon />
                      Habilitar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setConfirm({ user: u, action: "disable" })}
                      className="text-[#FF3737]"
                    >
                      <UserXIcon />
                      Sacar
                    </Button>
                  )
                ) : null}
                {!isSelf ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    aria-label="Borrar usuario"
                    title="Borrar usuario"
                    onClick={() => setConfirm({ user: u, action: "delete" })}
                    className="text-muted-foreground hover:text-[#FF3737]"
                  >
                    <Trash2Icon />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Crear */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              Se crea con una contraseña temporal que vas a ver una sola vez.
            </DialogDescription>
          </DialogHeader>
          <UserPermissionsForm
            mode="create"
            initial={{ email: "", displayName: "", role: "member", tabs: ["boveda"], credentialIds: [] }}
            credentials={credentials}
            pending={pending}
            submitLabel="Crear usuario"
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      {/* Editar */}
      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permisos de {editing?.displayName ?? editing?.email}</DialogTitle>
            <DialogDescription>
              Los cambios aplican en el próximo click de esa persona.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <UserPermissionsForm
              key={editing.id}
              mode="edit"
              isSelf={editing.id === currentUserId}
              initial={{
                email: editing.email,
                displayName: editing.displayName ?? "",
                role: editing.role,
                tabs: editing.role === "admin" ? [] : editing.tabs,
                credentialIds: credsOf(editing.id).map((c) => c.id),
              }}
              credentials={credentials}
              pending={pending}
              submitLabel="Guardar permisos"
              onSubmit={(v) => handleUpdate(editing, v)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Confirmar sacar / borrar */}
      <AlertDialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "delete" ? "Borrar" : "Sacar a"}{" "}
              {confirm?.user.displayName ?? confirm?.user.email}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "delete"
                ? "Se borra la cuenta. No se puede deshacer."
                : "No va a poder volver a entrar a la app. Lo podés habilitar de nuevo más adelante."}{" "}
              También pierde el acceso a todas las contraseñas de la Bóveda. Las
              que conocía hay que rotarlas: te las listo al terminar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/85"
            >
              {confirm?.action === "delete" ? "Borrar" : "Sacar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resultado: contraseña temporal o credenciales a rotar */}
      <Dialog open={result != null} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="sm:max-w-lg lg:max-w-lg xl:max-w-lg">
          {result?.kind === "temp" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {result.isNew ? "Usuario creado" : "Contraseña temporal nueva"}
                </DialogTitle>
                <DialogDescription>
                  Pasale estos datos a la persona. La contraseña no se vuelve a
                  mostrar. Cuando entre, la puede cambiar desde «Cambiar mi
                  contraseña», abajo en el menú.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Link</span>
                  <SecretValue value={appUrl} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <SecretValue value={result.email} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Contraseña temporal</span>
                  <SecretValue value={result.password} />
                </div>
                <SecretValue
                  className="mt-2"
                  value={`Entrá a ${appUrl} con ${result.email} y la contraseña ${result.password}. Después cambiala desde "Cambiar mi contraseña".`}
                />
              </div>
            </>
          ) : result?.kind === "rotate" ? (
            <>
              <DialogHeader>
                <DialogTitle>Rotá lo que conocía {result.name}</DialogTitle>
                <DialogDescription>
                  Ya no puede verlas en la app, pero las contraseñas que vio las
                  sigue sabiendo. Cambialas para cerrarle el acceso de verdad.
                  Cada una se abre en otra pestaña; esta lista queda acá hasta
                  que la cierres.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                {result.credentials.map((c) => (
                  <a
                    key={c.id}
                    href={`/boveda?rotar=${c.id}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2">
                      <KeyRoundIcon className="size-4 text-primary" />
                      {c.name}
                    </span>
                    <span className="text-xs text-primary">Rotar ahora ↗</span>
                  </a>
                ))}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
