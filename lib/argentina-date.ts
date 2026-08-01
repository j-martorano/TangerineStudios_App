const AR_TZ = "America/Argentina/Buenos_Aires";

/** Returns "YYYY-MM-DD" in Argentina local time. */
export function todayAR(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: AR_TZ }).format(date);
}

/** Returns "YYYY-MM" in Argentina local time. */
export function currentMonthKeyAR(date: Date = new Date()): string {
  return todayAR(date).slice(0, 7);
}

/**
 * ISO timestamp anchored to noon UTC on the Argentina calendar date.
 * Use instead of new Date().toISOString() when storing finalized_at / paid_at
 * so that UTC-based month bucket extraction always lands on the right month.
 */
export function nowISOArgentina(date: Date = new Date()): string {
  return todayAR(date) + "T12:00:00.000Z";
}
