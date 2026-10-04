"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { count, dayKey, rupiah, shortDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { PriceRow } from "@/lib/queries";

// Price periods on a month calendar: each date is tinted in the colour of the price that applies,
// the first day of a price is a filled circle, and a colour key sits below. Each price runs from its date until the day
// before the next one; the first also covers older orders (they use the earliest price).
const COLORS = [
  "var(--primary)",
  "var(--accent)",
  "var(--stage-green-fg)",
  "var(--stage-violet-fg)",
];

const DAY = 86_400_000;
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const show = (day: string) => shortDate(`${day}T12:00:00+07:00`);

function periods(rows: PriceRow[]) {
  const today = dayKey();
  return rows.map((r, i) => {
    const next = rows[i + 1]?.validFrom;
    const end = next ? new Date(dayMs(next) - DAY).toISOString().slice(0, 10) : null;
    const range =
      i === 0 && end
        ? `${t("price.until")} ${show(end)}`
        : i === 0
          ? t("price.always")
          : end
            ? `${show(r.validFrom)} – ${show(end)}`
            : `${t("price.since")} ${show(r.validFrom)}`;
    return { ...r, end, range, future: r.validFrom > today, color: COLORS[i % COLORS.length]! };
  });
}

type Period = ReturnType<typeof periods>[number];

// Short weekday names, Monday first (1 Jan 2024 was a Monday).
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(
    Date.UTC(2024, 0, 1 + i),
  ),
);

function MonthCalendar({ list }: { list: Period[] }) {
  const today = dayKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = Date.UTC(y, m - 1, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7; // Monday first
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (by: number) =>
    setMonth(new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7));
  const title = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(first);
  // The earliest price also covers older dates; the latest runs on with no end.
  const periodOf = (day: string) =>
    list.find((p, i) => (i === 0 || p.validFrom <= day) && (!p.end || day <= p.end));

  return (
    <div className="rounded-xl border border-border p-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t("price.prevMonth")}
          onClick={() => shift(-1)}
          className="grid size-9 place-items-center rounded-full text-muted-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="text-label font-semibold capitalize">{title}</p>
        <button
          type="button"
          aria-label={t("price.nextMonth")}
          onClick={() => shift(1)}
          className="grid size-9 place-items-center rounded-full text-muted-foreground"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-caption">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 font-medium text-muted-foreground">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead${i}`} />
        ))}
        {Array.from({ length }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`;
          const p = periodOf(day);
          const starts = p && p.validFrom === day;
          return (
            <span
              key={day}
              className="grid h-9 place-items-center"
              style={
                p ? { backgroundColor: `color-mix(in srgb, ${p.color} 18%, transparent)` } : {}
              }
            >
              <span
                className={`grid size-8 place-items-center rounded-full tabular-nums ${
                  starts ? "font-semibold text-white" : ""
                } ${day === today ? "ring-2 ring-foreground" : ""}`}
                style={starts && p ? { backgroundColor: p.color } : {}}
              >
                {i + 1}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function PriceTimeline({ title, rows }: { title: string; rows: PriceRow[] }) {
  if (rows.length === 0) return null;
  const list = periods(rows);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label font-medium">{title}</p>
      <MonthCalendar list={list} />
      <ul className="flex flex-col gap-1">
        {[...list].reverse().map((p) => (
          <li key={p.validFrom} className="flex items-center justify-between gap-2 text-label">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.range}
              {p.future && <span className="text-muted-foreground">({t("price.upcoming")})</span>}
            </span>
            <span className="font-semibold tabular-nums">{rupiah(p.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One timeline for the normal price and one per quantity price (e.g. from 100 eggs). */
export function ProductPriceTimelines({
  rows,
  kind = "sell",
}: {
  rows: PriceRow[];
  kind?: "sell" | "buy";
}) {
  const mins = [...new Set(rows.map((r) => r.minQty))].sort((a, b) => a - b);
  return (
    <>
      {mins.map((min) => (
        <PriceTimeline
          key={min}
          title={
            min
              ? t("price.historyTier").replace("{n}", count(min))
              : t(kind === "buy" ? "price.buyHistory" : "price.history")
          }
          rows={rows.filter((r) => r.minQty === min)}
        />
      ))}
    </>
  );
}
