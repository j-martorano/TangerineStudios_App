"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SecretValue } from "@/components/boveda/secret-tools";

export type TempPassword = { email: string; password: string; isNew: boolean };

/**
 * Muestra la contraseña temporal de una cuenta recién creada (o reseteada),
 * con el mensaje armado para copiar y pasárselo a la persona. Se usa desde
 * Usuarios y desde «Crear usuario» en la ficha de un editor.
 */
export function TempPasswordDialog({
  result,
  appUrl,
  onClose,
}: {
  result: TempPassword | null;
  appUrl: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={result != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg lg:max-w-lg xl:max-w-lg">
        {result ? (
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
