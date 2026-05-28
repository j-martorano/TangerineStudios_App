import { verifyKey } from "discord-interactions";

/**
 * Verifies a Discord interaction request using Ed25519.
 * Returns { valid, body } — body is the raw text (already consumed).
 *
 * verifyKey() can return boolean OR Promise<boolean> depending on the
 * runtime (Node uses sync crypto; edge runtimes may use async SubtleCrypto).
 */
export async function verifyDiscordRequest(
  req: Request
): Promise<{ valid: boolean; body: string }> {
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const body = await req.text();

  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? "";
  // Await handles both sync (boolean) and async (Promise<boolean>) return values
  const valid = await Promise.resolve(verifyKey(body, signature, timestamp, publicKey));

  return { valid, body };
}
