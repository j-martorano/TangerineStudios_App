import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de las contraseñas de la Bóveda. AES-256-GCM en el servidor:
 * la base de datos solo guarda texto cifrado, y la clave vive en la env var
 * VAULT_ENCRYPTION_KEY de Vercel (32 bytes en base64). Sin esa clave, una
 * copia de la base no sirve para leer contraseñas.
 *
 * Generar una clave:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Formato guardado: "v1:<iv base64>:<tag base64>:<cifrado base64>".
 *
 * El id de la credencial entra como "associated data": el texto cifrado de
 * una credencial no se puede copiar a otra y leerse con los permisos de esa.
 */

const PREFIX = "v1";

function getKey(): Buffer {
  const raw = process.env.VAULT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Falta VAULT_ENCRYPTION_KEY: la Bóveda no puede cifrar ni leer contraseñas"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("VAULT_ENCRYPTION_KEY tiene que ser 32 bytes en base64");
  }
  return key;
}

export function isVaultConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

export function encryptSecret(plain: string, credentialId: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(credentialId, "utf8"));
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(stored: string, credentialId: string): string {
  const [prefix, ivB64, tagB64, dataB64] = stored.split(":");
  if (prefix !== PREFIX || !ivB64 || !tagB64 || dataB64 == null) {
    throw new Error("Formato de contraseña cifrada desconocido");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Formato de contraseña cifrada desconocido");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(credentialId, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
