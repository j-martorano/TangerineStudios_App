import Image from "next/image";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { getViewer, homeFor } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * Para usuarios logueados que no tienen ninguna pestaña, están
 * deshabilitados o no tienen perfil.
 */
export default async function SinAccesoPage() {
  const viewer = await getViewer();
  const home = viewer ? homeFor(viewer) : null;
  if (home) redirect(home);

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <Image
          src="/branding/Logo_Y_Texto_Transparente.png"
          alt="Tangerine Studios"
          width={240}
          height={56}
          priority
          unoptimized
          className="h-12 w-auto object-contain"
        />
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">Todavía no tenés acceso</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta no tiene ninguna sección habilitada. Pedile a Joaco que te
            dé acceso.
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </main>
  );
}
