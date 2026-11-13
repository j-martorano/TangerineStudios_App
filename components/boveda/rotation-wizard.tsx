"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2Icon, ExternalLinkIcon, EyeIcon, RefreshCwIcon } from "lucide-react";
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
import { revealSecret, rotateCredential } from "@/lib/vault/actions";
import { generatePassword } from "@/lib/vault/password";
import { KIND_LABEL, rotationSteps } from "@/lib/vault/presets";
import type { CredentialSummary } from "@/lib/vault/queries";

import { SecretValue } from "./secret-tools";

type Props = {
  credential: CredentialSummary | null;
  /** Nombres de quienes la tienen habilitada (reciben el aviso). */
  audience: string[];
  onClose: () => void;
};

/**
 * Guía para rotar una contraseña:
 *   1. muestra la contraseña actual (los servicios la piden para cambiarla),
 *   2. genera la nueva,
 *   3. lista los pasos con links directos al servicio,
 *   4. recién cuando Joaco confirma que la cambió, la guarda. Si cierra antes,
 *      no cambia nada y la vieja sigue siendo la válida.
 */
export function RotationWizard({ credential, audience, onClose }: Props) {
  return (
    <Dialog open={credential != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {credential ? (
          <WizardBody key={credential.id} credential={credential} audience={audience} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function WizardBody({
  credential,
  audience,
  onClose,
}: {
  credential: CredentialSummary;
  audience: string[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<string | null>(null);
  // Se genera al abrir la guía (este componente solo existe en el cliente,
  // dentro del diálogo abierto).
  const [password, setPassword] = useState(() => generatePassword());
  const [custom, setCustom] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [notified, setNotified] = useState<string[] | null>(null);

  const steps = useMemo(
    () =>
      rotationSteps(credential.kind, {
        changePasswordUrl: credential.changePasswordUrl,
        loginUrl: credential.loginUrl,
      }),
    [credential]
  );

  function showCurrent() {
    startTransition(async () => {
      const res = await revealSecret(credential.id);
      if (res.ok) setCurrent(res.data.secret);
      else toast.error(res.error);
    });
  }

  function toggleStep(i: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const res = await rotateCredential(credential.id, password);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNotified(res.data.notified);
      toast.success(`Contraseña de ${credential.name} actualizada`);
    });
  }

  if (notified) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2Icon className="size-5 text-[#37FF62]" />
            Listo, {credential.name} rotada
          </DialogTitle>
          <DialogDescription>
            La contraseña nueva ya está en la Bóveda.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-white/[0.08] p-3 text-sm">
          {notified.length > 0 ? (
            <>
              <p className="mb-1 text-muted-foreground">Se avisó en la Bóveda a:</p>
              <p className="font-medium">{notified.join(", ")}</p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Nadie más tiene acceso a esta credencial, así que no se avisó a nadie.
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rotar contraseña de {credential.name}</DialogTitle>
        <DialogDescription>
          {KIND_LABEL[credential.kind]}
          {credential.username ? ` · ${credential.username}` : ""}. Nada se guarda
          hasta que confirmes al final: si cerrás antes, sigue valiendo la actual.
        </DialogDescription>
      </DialogHeader>

      <ol className="flex flex-col gap-5 text-sm">
        <li className="flex flex-col gap-2">
          <StepTitle n={1}>Tené a mano la contraseña actual</StepTitle>
          {current ? (
            <SecretValue value={current} />
          ) : (
            <Button variant="outline" size="sm" className="w-fit" onClick={showCurrent} disabled={pending}>
              <EyeIcon />
              Mostrar la actual
            </Button>
          )}
        </li>

        <li className="flex flex-col gap-2">
          <StepTitle n={2}>Esta es la contraseña nueva</StepTitle>
          {custom ? (
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Escribí la contraseña que quieras usar"
              className="font-mono"
            />
          ) : (
            <SecretValue value={password} />
          )}
          <div className="flex flex-wrap gap-2">
            {!custom ? (
              <Button variant="ghost" size="sm" onClick={() => setPassword(generatePassword())}>
                <RefreshCwIcon />
                Generar otra
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (custom) setPassword(generatePassword());
                setCustom(!custom);
              }}
            >
              {custom ? "Volver a la generada" : "Prefiero escribir una"}
            </Button>
          </div>
        </li>

        {steps.map((step, i) => (
          <li key={i} className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 accent-[#FFAC37]"
                checked={done.has(i)}
                onChange={() => toggleStep(i)}
              />
              <span className="flex flex-col gap-1">
                <span className={`font-medium ${done.has(i) ? "text-muted-foreground line-through" : ""}`}>
                  {i + 3}. {step.title}
                </span>
                {step.detail ? (
                  <span className="text-xs text-muted-foreground">{step.detail}</span>
                ) : null}
              </span>
            </label>
            {step.link ? (
              <a
                href={step.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-6 inline-flex w-fit items-center gap-1.5 rounded-md bg-[#37ACFF]/15 px-2.5 py-1 text-xs font-medium text-[#37ACFF] hover:bg-[#37ACFF]/25"
              >
                {step.link.label}
                <ExternalLinkIcon className="size-3" />
              </a>
            ) : null}
          </li>
        ))}

        <li className="flex flex-col gap-3 rounded-lg border border-[#FFAC37]/30 bg-[#FFAC37]/5 p-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 accent-[#FFAC37]"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              Ya cambié la contraseña en {credential.name} por la de arriba y
              entré con ella para probarla.
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            Al guardar se avisa en la Bóveda solo a quienes tienen esta credencial
            {audience.length > 0 ? `: ${audience.join(", ")}` : " (hoy nadie más)"}.
          </p>
          <Button
            onClick={save}
            disabled={!confirmed || pending || password.length < 8}
            className="w-fit"
          >
            {pending ? "Guardando…" : "Guardar la nueva y avisar"}
          </Button>
        </li>
      </ol>
    </>
  );
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="font-medium">
      {n}. {children}
    </span>
  );
}
