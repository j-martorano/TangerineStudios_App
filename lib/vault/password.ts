/**
 * Generador de contraseñas. Funciona en el navegador y en el servidor
 * (usa Web Crypto, no Math.random).
 *
 * Por defecto: 20 caracteres con mayúsculas, minúsculas, números y algunos
 * símbolos que aceptan Google, Adobe y Frame.io. Se sacan caracteres que se
 * confunden al leerlos (0/O, 1/l/I).
 */
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*-_+=?";

function randomIndex(max: number): number {
  // Rechazo para no sesgar la distribución.
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

function pick(set: string): string {
  return set[randomIndex(set.length)];
}

export function generatePassword(length = 20): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  // Garantizar al menos uno de cada tipo.
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  // Mezclar (Fisher-Yates).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
