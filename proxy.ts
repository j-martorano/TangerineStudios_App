import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all paths except Next internals y favicon. La lógica fina
    // (skip /branding/, login, etc.) la maneja el helper updateSession.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
