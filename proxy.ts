import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all paths except Next internals, favicon y assets públicos
    // estáticos (logo, paleta, etc. dentro de /branding). Sin esto el
    // middleware redirigía cada GET a /branding/Logo.png a /login para
    // visitantes no autenticados, dejando la página de login sin imagen.
    "/((?!_next/static|_next/image|favicon.ico|branding/).*)",
  ],
};
