/**
 * Verifies Discord Ed25519 interaction signatures using the native Web Crypto API.
 * Works in Node.js 18+ and all edge runtimes — no external crypto package needed.
 *
 * Discord signs every interaction as:
 *   signature = Ed25519.sign(timestamp + body, botPrivateKey)
 * We verify with the app's public key.
 */

function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export async function verifyDiscordRequest(
  req: Request
): Promise<{ valid: boolean; body: string }> {
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const body = await req.text();

  if (!signature || !timestamp) return { valid: false, body };

  try {
    const publicKeyHex = process.env.DISCORD_PUBLIC_KEY ?? "";
    const publicKeyBytes = hexToUint8Array(publicKeyHex);
    const signatureBytes = hexToUint8Array(signature);
    const message = new TextEncoder().encode(timestamp + body);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "Ed25519",
      cryptoKey,
      signatureBytes,
      message
    );

    return { valid, body };
  } catch (e) {
    console.error("[discord:verify] Signature verification error:", e);
    return { valid: false, body };
  }
}
