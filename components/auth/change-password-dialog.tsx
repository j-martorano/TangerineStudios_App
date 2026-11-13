"use client";

import { useState, useTransition } from "react";
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
import { changeOwnPassword } from "@/lib/auth/actions";

/** Para que cada usuario cambie la contraseña temporal que le dio Joaco. */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== repeat) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    startTransition(async () => {
      const res = await changeOwnPassword(password);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Contraseña cambiada");
      setPassword("");
      setRepeat("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm lg:max-w-sm xl:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar mi contraseña</DialogTitle>
          <DialogDescription>
            Es la contraseña para entrar a esta app, no la de la Bóveda.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-pass">Contraseña nueva</Label>
            <Input
              id="new-pass"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-pass-2">Repetila</Label>
            <Input
              id="new-pass-2"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              disabled={pending}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Cambiar contraseña"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
