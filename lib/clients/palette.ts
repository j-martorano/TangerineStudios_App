// Genera colores aleatorios para identificación de clientes.
// Usamos HSL con saturación alta y brillo medio para asegurar buen contraste
// sobre el fondo dark (#131200).

export function randomClientColor(): string {
  const h = Math.floor(Math.random() * 360);
  const s = 60 + Math.floor(Math.random() * 30); // 60–90%
  const l = 50 + Math.floor(Math.random() * 15); // 50–65%
  return hslToHex(h, s, l);
}

function hslToHex(h: number, s: number, l: number): string {
  const sd = s / 100;
  const ld = l / 100;
  const c = (1 - Math.abs(2 * ld - 1)) * sd;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = ld - c / 2;
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Devuelve negro o blanco según el contraste con el color de fondo.
export function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#131200" : "#F7F7F2";
}
