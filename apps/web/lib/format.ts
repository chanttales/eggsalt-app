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
