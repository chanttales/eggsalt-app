// Display helpers. Money is whole rupiah; dates are shown in the business time zone.

export const TIME_ZONE = "Asia/Jakarta";

export function rupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

export function count(n: number): string {
  return n.toLocaleString("id-ID");
}

/** YYYY-MM-DD of an instant in the business time zone, for comparing calendar days. */
export function dayKey(date: Date | string | number = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(date));
}

export function longDate(date: Date | string | number = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function shortDate(date: Date | string | number): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function time(date: Date | string | number): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** A calendar date typed by the user (YYYY-MM-DD) as the start of that day in Jakarta (UTC+7). */
export function startOfDay(day: string): string {
  return `${day}T00:00:00+07:00`;
}

/** Whole days from today (Jakarta) to a YYYY-MM-DD date; negative when it has passed. */
export function daysUntil(day: string): number {
  const ms = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${dayKey()}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export const PERIODS = ["day", "week", "month"] as const;
export type Period = (typeof PERIODS)[number];

/** Start of a report period in Jakarta: today, the last 7 days, or this calendar month. */
export function periodStart(period: Period): string {
  const today = dayKey();
  if (period === "day") return startOfDay(today);
  if (period === "month") return startOfDay(`${today.slice(0, 8)}01`);
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 6);
  return startOfDay(d.toISOString().slice(0, 10));
}
