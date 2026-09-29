// Business days follow the owners' calendar in Jakarta (WIB, UTC+7), not UTC. A date without a time
// is a "YYYY-MM-DD" string so it never shifts when it crosses time zones.

export const BUSINESS_TIME_ZONE = "Asia/Jakarta";

export type BusinessDate = string;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function assertBusinessDate(date: string): BusinessDate {
  const match = DATE_PATTERN.exec(date);
  const [, y, m, d] = match ?? [];
  const utc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (!match || utc.toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Expected a date like 2026-09-29, got ${date}`);
  }
  return date;
}

const calendarDateFormats = new Map<string, Intl.DateTimeFormat>();

/** The calendar date of an instant in the business time zone, e.g. 2026-09-28T18:00Z -> "2026-09-29". */
export function businessDate(instant: Date, timeZone: string = BUSINESS_TIME_ZONE): BusinessDate {
  let format = calendarDateFormats.get(timeZone);
  if (!format) {
    // en-CA formats as YYYY-MM-DD.
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    calendarDateFormats.set(timeZone, format);
  }
  return format.format(instant);
}

function toUtcMs(date: BusinessDate): number {
  return Date.parse(`${assertBusinessDate(date)}T00:00:00Z`);
}

/** Calendar arithmetic, e.g. addDays("2026-09-29", 5) -> "2026-10-04". */
export function addDays(date: BusinessDate, days: number): BusinessDate {
  if (!Number.isSafeInteger(days)) {
    throw new RangeError(`Days must be a whole number, got ${days}`);
  }
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole calendar days from one date to another; negative when `to` is earlier. */
export function daysBetween(from: BusinessDate, to: BusinessDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

const displayDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "29 Sep 2026". */
export function formatBusinessDate(date: BusinessDate): string {
  return displayDate.format(new Date(toUtcMs(date)));
}
