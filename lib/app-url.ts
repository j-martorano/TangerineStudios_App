import { headers } from "next/headers";

/**
 * URL pública de la app según el request actual. Sirve para armar links que
 * se le pasan a una persona por mensaje (p. ej. junto a su contraseña
 * temporal), sin depender de una env var.
 */
export async function getAppUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}
