"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellIcon,
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
  deleteCredential,
  markVaultNotificationsRead,
  revealSecret,
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
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // ?rotar=<id> (viene de «Sacar» en Usuarios) abre la guía directamente.
  const [rotating, setRotating] = useState<CredentialSummary | null>(() =>
    isAdmin && rotateId ? credentials.find((x) => x.id === rotateId) ?? null : null
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialWithAccess | null>(null);
  const [deleting, setDeleting] = useState<CredentialSummary | null>(null);

  const nameOf = (id: string | null) =>
    id ? users.find((u) => u.id === id)?.name ?? "alguien" : "alguien";

  // Limpia ?rotar= de la URL para que un refresh no reabra la guía.
  useEffect(() => {
    if (rotateId) router.replace("/boveda");
  }, [rotateId, router]);

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

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
      setRevealed((r) => ({ ...r, [id]: res.data.secret }));
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => hide(id), REVEAL_MS);
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
  const audienceOf = (c: CredentialSummary & { userIds?: string[] }) =>
    (c.userIds ?? []).map((id) => nameOf(id));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-5xl font-bold uppercase tracking-tight">Bóveda</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Las contraseñas compartidas. Elegís quién ve cada una y las rotás cuando sale alguien."
              : "Las contraseñas compartidas que tenés habilitadas."}
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
            <PlusIcon />
            Nueva credencial
          </Button>
        ) : null}
      </header>

      {!configured ? (
        <div className="rounded-xl border border-[#FF3737]/40 bg-[#FF3737]/10 p-4 text-sm">
          Falta configurar la clave de cifrado (<code>VAULT_ENCRYPTION_KEY</code>) en
          Vercel. Sin ella la Bóveda no puede guardar ni mostrar contraseñas.
        </div>
      ) : null}

      {unread.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-[#FFAC37]/40 bg-[#FFAC37]/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BellIcon className="size-4 text-[#FFAC37]" />
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
        <div className="rounded-xl border border-dashed border-white/[0.12] p-10 text-center text-sm text-muted-foreground">
          {isAdmin
            ? "No hay credenciales cargadas. Empezá con «Nueva credencial»."
            : "No tenés ninguna contraseña habilitada. Si necesitás una, pedísela a Joaco."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {credentials.map((c) => {
            const secret = revealed[c.id];
            const audience = audienceOf(c);
            return (
              <article
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#1a1a1a] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <KeyRoundIcon className="size-4 text-[#FFAC37]" />
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
                  <div className="rounded-md border border-white/[0.08] bg-black/40 px-3 py-2 font-mono text-sm tracking-widest text-muted-foreground">
                    ••••••••••••
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
                        className="bg-[#FFAC37] text-black hover:bg-[#FFAC37]/85"
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
                  <div className="flex flex-wrap items-center gap-1 border-t border-white/[0.06] pt-2 text-xs text-muted-foreground">
                    <UsersIcon className="size-3" />
                    {audience.length === 0 ? (
                      "Solo admins"
                    ) : (
                      audience.map((n) => (
                        <Badge key={n} variant="secondary" className="font-normal">
                          {n}
                        </Badge>
                      ))
                    )}
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
          <ul className="flex flex-col divide-y divide-white/[0.05] rounded-xl border border-white/[0.08] text-sm">
            {events.map((e) => {
              const cred = credentials.find((c) => c.id === e.credentialId);
              return (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">
                    {DATETIME.format(new Date(e.createdAt))}
                  </span>
                  <span>
                    <span className="font-medium">{nameOf(e.actorId)}</span>{" "}
                    {EVENT_LABEL[e.event] ?? e.event}{" "}
                    {e.targetUserId ? (
                      <>
                        <span className="font-medium">{nameOf(e.targetUserId)}</span> en{" "}
                      </>
                    ) : null}
                    <span className="font-medium">{cred?.name ?? "una credencial borrada"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <RotationWizard
        credential={rotating}
        audience={rotating ? audienceOf(rotating) : []}
        onClose={() => setRotating(null)}
      />

      {isAdmin ? (
        <CredentialFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          credential={editing}
          users={users}
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
              className="bg-[#FF3737] text-white hover:bg-[#FF3737]/85"
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
