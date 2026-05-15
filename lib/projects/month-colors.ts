/**
 * Color automático por mes — paleta fija de 12 tonos (uno por mes del
 * calendario). Cada enero del año X usa el mismo color, sin importar el año.
 * Pensado para dark mode: lightness alta y saturación moderada para mantener
 * legibilidad sobre `--background` (#131200).
 */

const MONTH_HUES: number[] = [
  210, // enero — azul
  340, // febrero — rosado
  280, // marzo — violeta
  140, // abril — verde menta
  60, // mayo — amarillo
  20, // junio — naranja
  180, // julio — cyan
  300, // agosto — magenta
  100, // septiembre — verde lima
  40, // octubre — ámbar
  240, // noviembre — índigo
  0, // diciembre — rojo
];

export type MonthTone = {
  /** Color sólido del mes, usable como bg de un chip. */
  solid: string;
  /** Tint suave para fondo de filas/cards. */
  tint: string;
  /** Color de acento para borde-izquierdo o subrayado. */
  accent: string;
};

/**
 * Devuelve los colores del mes en CSS (oklch sería mejor pero hsl tiene
 * mejor soporte en todos lados sin parser custom).
 *
 * @param iso ISO 8601 timestamp del proyecto (created_at). Si es null,
 *            devuelve tones neutros.
 */
export function monthTone(iso: string | null | undefined): MonthTone {
  if (!iso) {
    return {
      solid: "hsl(0 0% 50%)",
      tint: "hsl(0 0% 50% / 0.06)",
      accent: "hsl(0 0% 50% / 0.5)",
    };
  }
  const d = new Date(iso);
  const month = d.getUTCMonth(); // 0-11
  const hue = MONTH_HUES[month] ?? 0;
  return {
    solid: `hsl(${hue} 70% 60%)`,
    tint: `hsl(${hue} 70% 50% / 0.08)`,
    accent: `hsl(${hue} 70% 55% / 0.6)`,
  };
}

/**
 * Devuelve solo el accent para usar como border-left. Útil cuando ya tenés
 * el yearMonth string ("YYYY-MM") en vez de un timestamp.
 */
export function monthToneFromKey(yearMonth: string): MonthTone {
  // El día no importa para sacar el mes, usamos día 1 a mediodía UTC.
  return monthTone(`${yearMonth}-15T12:00:00Z`);
}
