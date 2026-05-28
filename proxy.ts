import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all paths except:
    // - Next internals (_next/static, _next/image)
    // - Favicon y assets públicos (branding/)
    // - API routes del bot de Discord (/api/discord/) — reciben requests
    //   externos sin sesión, tienen su propia verificación de firma Ed25519
    "/((?!_next/static|_next/image|favicon.ico|branding/|api/discord/).*)",
  ],
};
