"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  RotateCwIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { QuickBadges } from "@/components/quick-badges";
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
  deleteCredential,
  markVaultNotificationsRead,
  revealSecret,
  updateCredentialAccess,
} from "@/lib/vault/actions";
import { KIND_LABEL } from "@/lib/vault/presets";
import type {
  CredentialSummary,
  CredentialWithAccess,
  VaultEventRow,
  VaultNotification,
} from "@/lib/vault/queries";

import { CredentialFormDialog, type VaultUser } from "./credential-form";
import { RotationWizard } from "./rotation-wizard";
import { CopyButton, SecretValue } from "./secret-tools";

type Props = {
  isAdmin: boolean;
  configured: boolean;
  credentials: (CredentialSummary & { userIds?: string[] })[];
  notifications: VaultNotification[];
  users: VaultUser[];
  events: VaultEventRow[];
  rotateId: string | null;
};

const DATE = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});
const DATETIME = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const EVENT_LABEL: Record<string, string> = {
  created: "cargó",
  updated: "editó",
  rotated: "rotó",
  viewed: "vio",
  access_granted: "dio acceso a",
  access_revoked: "quitó acceso a",
  deleted: "borró",
};

/** Cuánto tiempo queda visible una contraseña revelada. */
const REVEAL_MS = 30_000;

export function VaultView({
  isAdmin,
  configured,
  credentials,
  notifications,
  users,
  events,
  rotateId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // ?rotar=<id> (viene de «Sacar» en Usuarios) abre la guía directamente.
  const [rotating, setRotating] = useState<CredentialSummary | null>(() =>
    isAdmin && rotateId ? credentials.find((x) => x.id === rotateId) ?? null : null
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialWithAccess | null>(null);
  const [deleting, setDeleting] = useState<CredentialSummary | null>(null);

  // Incluye deshabilitados: el historial tiene que decir quién fue.
  const nameOf = (id: string | null, fallback?: string | null) =>
    (id ? users.find((u) => u.id === id)?.name : null) ?? fallback ?? "alguien";
  const activeUsers = users.filter((u) => !u.disabled);

  // Limpia ?rotar= de la URL para que un refresh no reabra la guía.
  useEffect(() => {
    if (rotateId) router.replace("/boveda");
  }, [rotateId, router]);

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  function show(id: string, secret: string) {
    setRevealed((r) => ({ ...r, [id]: secret }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => hide(id), REVEAL_MS);
  }

  function reveal(id: string) {
    if (revealed[id]) {
      hide(id);
      return;
    }
    startTransition(async () => {
      const res = await revealSecret(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      show(id, res.data.secret);
    });
  }

  /** Copia la contraseña sin mostrarla. Queda registrado igual que verla. */
  function copySecret(c: CredentialSummary) {
    startTransition(async () => {
      let secret = revealed[c.id];
      if (!secret) {
        const res = await revealSecret(c.id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        secret = res.data.secret;
      }
      try {
        await navigator.clipboard.writeText(secret);
        setCopiedId(c.id);
        setTimeout(() => setCopiedId((cur) => (cur === c.id ? null : cur)), 1500);
      } catch {
        // Sin permiso de portapapeles: se muestra para copiarla a mano.
        show(c.id, secret);
        toast.error("No se pudo copiar. Te la muestro para que la copies a mano.");
      }
    });
  }

  /** Acción rápida: cambia quién ve una credencial desde los badges de la card. */
  function changeAccess(c: CredentialSummary, next: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = await updateCredentialAccess(c.id, next);
        if (!res.ok) {
          toast.error(res.error);
          resolve(false);
          return;
        }
        resolve(true);
        const revoked = res.data.revokedNames;
        if (revoked.length > 0) {
          toast.warning(`${revoked.join(", ")} ya no ve${revoked.length > 1 ? "n" : ""} ${c.name}`, {
            description: "Pero conoce la contraseña actual. Rotala para cerrarle el acceso.",
            duration: 15000,
            action: { label: "Rotar ahora", onClick: () => setRotating(c) },
          });
        }
      });
    });
  }

  function hide(id: string) {
    clearTimeout(timers.current[id]);
    setRevealed((r) => {
      const next = { ...r };
      delete next[id];
      return next;
    });
  }

  function markRead() {
    startTransition(async () => {
      const res = await markVaultNotificationsRead();
      if (!res.ok) toast.error(res.error);
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const res = await deleteCredential(target.id);
      setDeleting(null);
      if (!res.ok) toast.error(res.error);
      else toast.success(`${target.name} borrada`);
    });
  }

  const unread = notifications.filter((n) => !n.readAt);
  // A quién se le puede dar acceso desde la card. Quien no tiene la pestaña
  // Bóveda puede quedar marcado (p. ej. para cuando se la den) pero no la ve.
  const accessOptions = activeUsers.map((u) => ({
    id: u.id,
    label: u.name,
    hint: u.hasVaultTab ? undefined : "No tiene la pestaña Bóveda: no la va a ver",
    warning: u.hasVaultTab ? undefined : "No tiene la pestaña Bóveda: dásela en Usuarios",
  }));
  // A quién le llega el aviso al rotar: la misma regla que el trigger
  // vault_notify_rotation (habilitado y con la pestaña Bóveda o admin).
  const notifiedOf = (c: CredentialSummary & { userIds?: string[] }) =>
    (c.userIds ?? [])
      .map((id) => activeUsers.find((u) => u.id === id))
      .filter((u): u is VaultUser => u != null && u.hasVaultTab)
      .map((u) => u.name);

  return (
    <>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Bóveda</h1>
          <p className="text-sm text-muted-foreground">
            {credentials.length} contraseña{credentials.length === 1 ? "" : "s"}
            {isAdmin ? " compartida" : " habilitada"}
            {credentials.length === 1 ? "" : "s"}
          </p>
        </div>
        {isAdmin ? (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={!configured}
          >
            <PlusIcon className="size-4" />
            Nueva credencial
          </Button>
        ) : null}
      </header>

      {!configured ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Falta configurar la clave de cifrado (<code>VAULT_ENCRYPTION_KEY</code>) en
          Vercel. Sin ella la Bóveda no puede guardar ni mostrar contraseñas.
        </div>
      ) : null}

      {unread.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BellIcon className="size-4 text-primary" />
            Novedades
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {unread.map((n) => (
              <li key={n.id}>
                {n.message}{" "}
                <span className="text-xs text-muted-foreground">
                  {DATETIME.format(new Date(n.createdAt))}
                </span>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="w-fit" onClick={markRead} disabled={pending}>
            Entendido
          </Button>
        </div>
      ) : null}

      {credentials.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-muted/20 py-16 text-center">
          <KeyRoundIcon className="size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "No hay credenciales cargadas. Empezá con «Nueva credencial»."
              : "No tenés ninguna contraseña habilitada. Si necesitás una, pedísela a un administrador."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {credentials.map((c) => {
            const secret = revealed[c.id];
            return (
              <article
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                      <KeyRoundIcon className="size-4 text-primary" />
                      {c.name}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {KIND_LABEL[c.kind]} · cambiada el {DATE.format(new Date(c.rotatedAt))}
                    </span>
                  </div>
                  {c.loginUrl ? (
                    <a
                      href={c.loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#37ACFF] hover:underline"
                    >
                      Abrir
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  ) : null}
                </div>

                {c.username ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-mono">{c.username}</span>
                    <CopyButton value={c.username} label="Copiar usuario" />
                  </div>
                ) : null}

                {secret ? (
                  <SecretValue value={secret} />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm tracking-widest text-muted-foreground">
                      ••••••••••••
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copySecret(c)}
                      disabled={pending || !configured}
                      aria-label="Copiar contraseña"
                      title="Copiar la contraseña sin mostrarla"
                    >
                      {copiedId === c.id ? <CheckIcon className="text-[#37FF62]" /> : <CopyIcon />}
                      {copiedId === c.id ? "Copiada" : "Copiar"}
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reveal(c.id)}
                    disabled={pending || !configured}
                  >
                    {secret ? <EyeOffIcon /> : <EyeIcon />}
                    {secret ? "Ocultar" : "Ver contraseña"}
                  </Button>
                  {isAdmin ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setRotating(c)}
                        disabled={pending || !configured}
                      >
                        <RotateCwIcon />
                        Rotar contraseña
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(c as CredentialWithAccess);
                          setFormOpen(true);
                        }}
                        disabled={pending}
                      >
                        <PencilIcon />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Borrar credencial"
                        title="Borrar credencial"
                        onClick={() => setDeleting(c)}
                        disabled={pending}
                        className="text-muted-foreground hover:text-[#FF3737]"
                      >
                        <Trash2Icon />
                      </Button>
                    </>
                  ) : null}
                </div>

                {c.notes ? (
                  <p className="text-xs text-muted-foreground">{c.notes}</p>
                ) : null}

                {isAdmin ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                    <UsersIcon className="size-3 shrink-0" />
                    <QuickBadges
                      selected={c.userIds ?? []}
                      options={accessOptions}
                      onChange={(next) => changeAccess(c, next)}
                      addLabel="Dar acceso"
                      emptyLabel={<span>Solo admins</span>}
                      disabled={pending}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {isAdmin && events.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Actividad reciente
          </h2>
          <ul className="flex flex-col divide-y divide-border/50 rounded-xl border bg-card text-sm">
            {events.map((e) => {
              const cred = credentials.find((c) => c.id === e.credentialId);
              return (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">
                    {DATETIME.format(new Date(e.createdAt))}
                  </span>
                  <span>
                    <span className="font-medium">{nameOf(e.actorId, e.actorEmail)}</span>{" "}
                    {EVENT_LABEL[e.event] ?? e.event}{" "}
                    {e.targetUserId ? (
                      <>
                        <span className="font-medium">{nameOf(e.targetUserId, e.targetEmail)}</span> en{" "}
                      </>
                    ) : null}
                    <span className="font-medium">{cred?.name ?? e.credentialName ?? "una credencial borrada"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <RotationWizard
        credential={rotating}
        audience={rotating ? notifiedOf(rotating) : []}
        onClose={() => {
          // La contraseña vieja no tiene que quedar a la vista.
          if (rotating) hide(rotating.id);
          setRotating(null);
        }}
      />

      {isAdmin ? (
        <CredentialFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          credential={editing}
          users={activeUsers}
        />
      ) : null}

      <AlertDialog open={deleting != null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar {deleting?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra de la Bóveda para todos. La cuenta en el servicio no se toca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/85"
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
