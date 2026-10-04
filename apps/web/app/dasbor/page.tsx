"use client";

import { useState } from "react";
import { Choice } from "@/components/stock-sheets";
import { EmptyState, Page, Section, StatTile, ListSkeleton } from "@/components/ui";
import { count, dayKey, PERIODS, periodStart, rupiah, shortDate, type Period } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useDailySold, useProfitReport, useStockLevels } from "@/lib/queries";
import { useSession } from "@/lib/session";

const CHART_DAYS = 14;

function daysAgo(n: number): string {
  const d = new Date(`${dayKey()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Eggs sold per day: one series, so no legend; each bar names its day and count on hover and
// for screen readers, and the busiest day carries a direct label.
function SoldChart({ days }: { days: { day: string; qty: number }[] }) {
  const max = Math.max(...days.map((d) => d.qty), 1);
  const peak = days.reduce((a, b) => (b.qty > a.qty ? b : a), days[0] ?? { day: "", qty: 0 });
  return (
    <figure className="flex flex-col gap-2">
      <div
        role="list"
        aria-label={t("dash.soldChart")}
        className="flex h-40 items-end gap-0.5 border-b border-border"
      >
        {days.map((d) => (
          <div
            key={d.day}
            role="listitem"
            aria-label={`${shortDate(d.day)}: ${count(d.qty)} ${t("unit.egg")}`}
            title={`${shortDate(d.day)}: ${count(d.qty)} ${t("unit.egg")}`}
            className="group relative flex h-full flex-1 items-end"
          >
            {d.day === peak.day && d.qty > 0 && (
              <span
                className="absolute inset-x-0 text-center text-caption font-semibold tabular-nums"
                style={{ bottom: `calc(${(d.qty / max) * 100}% + 2px)` }}
              >
                {count(d.qty)}
              </span>
            )}
            <div
              className="w-full rounded-t-sm bg-primary group-hover:opacity-80"
              style={{ height: d.qty ? `max(2px, ${(d.qty / max) * 100}%)` : 0 }}
            />
          </div>
        ))}
      </div>
      <figcaption className="flex justify-between text-caption text-muted-foreground">
        <span>{shortDate(days[0]?.day ?? dayKey())}</span>
        <span>{t("dash.today")}</span>
      </figcaption>
    </figure>
  );
}

// Dasbor: the period's sales and profit, eggs sold per day, and stock ready to sell.
export default function DashboardPage() {
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";
  const [period, setPeriod] = useState<Period>("week");
  const report = useProfitReport(periodStart(period));
  const sold = useDailySold(daysAgo(CHART_DAYS - 1));
  const levels = useStockLevels();

  if (!isOwner) {
    return (
      <Page back="/profil" title={t("dash.title")}>
        <EmptyState>{t("money.ownerOnly")}</EmptyState>
      </Page>
    );
  }

  const orders = report.data?.orders ?? [];
  const revenue = orders.reduce((s, o) => s + o.revenue, 0);
  const gross = orders.reduce((s, o) => s + o.profit, 0);
  const expenses = (report.data?.expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const net = gross - expenses;
  const stock = (levels.data ?? []).filter((l) => l.sellable);

  return (
    <Page back="/profil" guide="dasbor" title={t("dash.title")}>
      <Choice
        label={t("report.period")}
        options={PERIODS}
        value={period}
        onChange={setPeriod}
        name={(p) => t(`money.period.${p}`)}
      />
      <div className="grid grid-cols-2 gap-2">
        <StatTile label={t("profit.revenue")} value={rupiah(revenue)} />
        <StatTile label={t("dash.orders")} value={count(orders.length)} />
        <StatTile label={t("report.gross")} value={rupiah(gross)} />
        <StatTile
          label={t("report.net")}
          value={rupiah(net)}
          tone={net < 0 ? "warning" : undefined}
        />
      </div>

      <Section title={t("dash.soldChart")}>
        {sold.data ? <SoldChart days={sold.data} /> : <ListSkeleton />}
      </Section>

      <Section title={t("dash.stock")}>
        {stock.length === 0 ? (
          levels.isPending ? (
            <ListSkeleton rows={2} />
          ) : (
            <EmptyState>{t("stock.noLots")}</EmptyState>
          )
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {stock.map((l) => (
              <StatTile
                key={l.stateId}
                label={`${l.stateName} · ${t("stock.available")}`}
                value={`${count(l.available)} ${t("unit.egg")}`}
                href="/stok"
              />
            ))}
          </div>
        )}
      </Section>
    </Page>
  );
}
