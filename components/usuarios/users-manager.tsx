"use client";

import { useState, useTransition } from "react";
import {
  FilmIcon,
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
import {
  createUser,
  deleteUser,
  disableUser,
  enableUser,
  resetUserPassword,
  updateUserPermissions,
} from "@/lib/users/actions";
import type { KnownCredential } from "@/lib/vault/events";
import type { AppUser, EditorChoice } from "@/lib/users/queries";
import { QuickBadges } from "@/components/quick-badges";
import { VISIBLE_TABS, isTabKey } from "@/lib/auth/tabs";

import { TempPasswordDialog, type TempPassword } from "./temp-password-dialog";
import { UserPermissionsForm, type PermissionsValue } from "./user-permissions-form";

type Credential = { id: string; name: string; userIds: string[] };

type Props = {
  users: AppUser[];
  credentials: Credential[];
  editors: EditorChoice[];
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

type Pending = { kind: "rotate"; name: string; credentials: KnownCredential[] } | null;

export function UsersManager({ users, credentials, editors, currentUserId, appUrl }: Props) {
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [confirm, setConfirm] = useState<{ user: AppUser; action: "disable" | "delete" } | null>(null);
  // Al sacar a un editor: también deshabilitar su ficha de /editors.
  const [alsoEditor, setAlsoEditor] = useState(true);
  const [result, setResult] = useState<Pending>(null);
  const [temp, setTemp] = useState<TempPassword | null>(null);

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
        editorId: v.editorId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCreateOpen(false);
      if (res.data.warning) toast.warning(res.data.warning, { duration: 15000 });
      setTemp({ email: v.email, password: res.data.tempPassword, isNew: true });
    });
  }

  function handleUpdate(user: AppUser, v: PermissionsValue) {
    startTransition(async () => {
      const res = await updateUserPermissions(user.id, {
        displayName: v.displayName || null,
        role: v.role,
        tabs: v.tabs,
        credentialIds: v.credentialIds,
        editorId: v.editorId,
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

  /**
   * Acción rápida desde los badges de la fila: manda los permisos completos
   * con el cambio aplicado. Si la persona pierde contraseñas que conocía,
   * aparece la misma lista para rotar que en el formulario.
   */
  function quickUpdate(
    user: AppUser,
    patch: { tabs?: string[]; credentialIds?: string[] }
  ): Promise<boolean> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await updateUserPermissions(user.id, {
          displayName: user.displayName,
          role: user.role,
          tabs: (patch.tabs ?? user.tabs).filter(isTabKey),
          credentialIds: patch.credentialIds ?? credsOf(user.id).map((c) => c.id),
        });
        if (!res.ok) {
          toast.error(res.error);
          resolve(false);
          return;
        }
        resolve(true);
        if (res.data.lostCredentials.length > 0) {
          setResult({
            kind: "rotate",
            name: user.displayName ?? user.email,
            credentials: res.data.lostCredentials,
          });
        }
      });
    });
  }

  function handleReset(user: AppUser) {
    startTransition(async () => {
      const res = await resetUserPassword(user.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTemp({ email: user.email, password: res.data.tempPassword, isNew: false });
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
      const res =
        action === "disable"
          ? await disableUser(user.id, { disableEditor: alsoEditor && user.editor != null })
          : await deleteUser(user.id);
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
                  {u.editor ? (
                    <Badge
                      variant="outline"
                      className="gap-1 font-normal text-muted-foreground"
                      title="Ficha vinculada en Editores"
                    >
                      <FilmIcon className="size-3" />
                      {u.editor.name}
                      {u.editor.disabledAt ? " (deshabilitado)" : ""}
                    </Badge>
                  ) : null}
                  {u.disabled ? <Badge variant="destructive">Deshabilitado</Badge> : null}
                </div>
                {u.displayName ? (
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                ) : null}
                <div className="flex flex-wrap items-center gap-1">
                  {u.role === "admin" ? (
                    <span className="text-xs text-muted-foreground">Todas las pestañas</span>
                  ) : u.disabled ? (
                    u.tabs.length === 0 ? (
                      <span className="text-xs text-[#FF3737]">Sin pestañas: no ve nada</span>
                    ) : (
                      VISIBLE_TABS.filter((t) => u.tabs.includes(t.key)).map((t) => (
                        <Badge key={t.key} variant="secondary" className="font-normal">
                          {t.label}
                        </Badge>
                      ))
                    )
                  ) : (
                    <QuickBadges
                      selected={VISIBLE_TABS.filter((t) => u.tabs.includes(t.key)).map((t) => t.key)}
                      options={VISIBLE_TABS.map((t) => ({ id: t.key, label: t.label }))}
                      onChange={(next) => quickUpdate(u, { tabs: next })}
                      addLabel="Pestaña"
                      emptyLabel={
                        <span className="text-xs text-[#FF3737]">Sin pestañas: no ve nada</span>
                      }
                      disabled={pending}
                    />
                  )}
                </div>
                {u.disabled ? (
                  creds.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <KeyRoundIcon className="size-3 text-primary" />
                      {creds.map((c) => c.name).join(" · ")}
                    </div>
                  ) : null
                ) : credentials.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <KeyRoundIcon className="size-3 shrink-0 text-primary" />
                    <QuickBadges
                      selected={creds.map((c) => c.id)}
                      options={credentials.map((c) => ({
                        id: c.id,
                        label: c.name,
                        hint:
                          u.role === "admin"
                            ? "Un admin ya la ve: marcarla solo le manda los avisos al rotarla"
                            : undefined,
                      }))}
                      onChange={(next) => quickUpdate(u, { credentialIds: next })}
                      addLabel="Contraseña"
                      disabled={pending}
                    />
                    {u.role !== "admin" && creds.length > 0 && !u.tabs.includes("boveda") ? (
                      <span className="text-primary">Sin la pestaña Bóveda no las ve</span>
                    ) : null}
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
                      onClick={() => {
                        setAlsoEditor(true);
                        setConfirm({ user: u, action: "disable" });
                      }}
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
            initial={{
              email: "",
              displayName: "",
              role: "member",
              tabs: ["boveda"],
              credentialIds: [],
              editorId: null,
            }}
            credentials={credentials}
            editors={editors}
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
                editorId: editing.editor?.id ?? null,
              }}
              credentials={credentials}
              editors={editors}
              userId={editing.id}
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
          {confirm?.action === "disable" && confirm.user.editor && !confirm.user.editor.disabledAt ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={alsoEditor}
                onChange={(e) => setAlsoEditor(e.target.checked)}
              />
              <span className="flex flex-col">
                <span>También deshabilitar su ficha de editor ({confirm.user.editor.name})</span>
                <span className="text-xs text-muted-foreground">
                  Deja de aparecer en las listas para asignar proyectos. Lo que ya
                  tiene asignado no se toca.
                </span>
              </span>
            </label>
          ) : null}
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

      {/* Contraseña temporal (cuenta nueva o reseteada) */}
      <TempPasswordDialog result={temp} appUrl={appUrl} onClose={() => setTemp(null)} />

      {/* Credenciales a rotar */}
      <Dialog open={result != null} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="sm:max-w-lg lg:max-w-lg xl:max-w-lg">
          {result?.kind === "rotate" ? (
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
