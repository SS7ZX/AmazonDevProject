/** Date helpers pinned to the household's timezone (default Asia/Jakarta). */
export const TZ = process.env.HOUSEHOLD_TIMEZONE || "Asia/Jakarta";

/** YYYY-MM-DD for "today" in the household timezone. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function weekdayName(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(now);
}

/** Whole days from today to an ISO date (negative = overdue). */
export function daysUntil(iso: string, now = new Date()): number {
  const a = Date.parse(todayISO(now) + "T00:00:00Z");
  const b = Date.parse(iso + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}
