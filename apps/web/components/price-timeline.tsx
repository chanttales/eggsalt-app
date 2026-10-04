"use client";

import { count, dayKey, rupiah, shortDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { PriceRow } from "@/lib/queries";

// Price periods as coloured blocks with a key below. Each price runs from its date until the day
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
    const until = end ?? (r.validFrom > today ? r.validFrom : today);
    const days = Math.max(1, Math.round((dayMs(until) - dayMs(r.validFrom)) / DAY) + 1);
    const range =
      i === 0 && end
        ? `${t("price.until")} ${show(end)}`
        : i === 0
          ? t("price.always")
          : end
            ? `${show(r.validFrom)} – ${show(end)}`
            : `${t("price.since")} ${show(r.validFrom)}`;
    return { ...r, days, range, future: r.validFrom > today, color: COLORS[i % COLORS.length]! };
  });
}

export function PriceTimeline({ title, rows }: { title: string; rows: PriceRow[] }) {
  if (rows.length === 0) return null;
  const list = periods(rows);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label font-medium">{title}</p>
      <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-surface-muted">
        {list.map((p) => (
          <span
            key={p.validFrom}
            className="h-full min-w-2 border-r-2 border-surface last:border-r-0"
            style={{ flexGrow: p.days, backgroundColor: p.color }}
          />
        ))}
      </div>
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
export function ProductPriceTimelines({ rows }: { rows: PriceRow[] }) {
  const mins = [...new Set(rows.map((r) => r.minQty))].sort((a, b) => a - b);
  return (
    <>
      {mins.map((min) => (
        <PriceTimeline
          key={min}
          title={min ? t("price.historyTier").replace("{n}", count(min)) : t("price.history")}
          rows={rows.filter((r) => r.minQty === min)}
        />
      ))}
    </>
  );
}
