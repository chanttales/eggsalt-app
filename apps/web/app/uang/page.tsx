"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ExpenseSheet } from "@/components/expense-sheet";
import { EmptyState, Page, Section, StatTile, primaryButton } from "@/components/ui";
import { dayKey, rupiah, shortDate, startOfDay, time } from "@/lib/format";
import { t, tOr } from "@/lib/i18n";
import { useMoneyEntries, useOrderMoney, type MoneyEntry } from "@/lib/queries";
import { useSession } from "@/lib/session";

const PERIODS = ["day", "week", "month"] as const;
type Period = (typeof PERIODS)[number];

/** Start of the period in Jakarta: today, the last 7 days, or this calendar month. */
function periodStart(period: Period): string {
  const today = dayKey();
  if (period === "day") return startOfDay(today);
  if (period === "month") return startOfDay(`${today.slice(0, 8)}01`);
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 6);
  return startOfDay(d.toISOString().slice(0, 10));
}

// S12 Uang: money in and out for the period, orders still owed, and the ledger itself.
function MoneyScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";
  const [period, setPeriod] = useState<Period>("day");
  const entries = useMoneyEntries(periodStart(period));
  const orders = useOrderMoney();

  if (!isOwner) {
    return (
      <Page title={t("nav.money")}>
        <EmptyState>{t("money.ownerOnly")}</EmptyState>
      </Page>
    );
  }

  const live = (entries.data ?? []).filter((e) => !e.reversed);
  const sum = (dir: MoneyEntry["direction"]) =>
    live.filter((e) => e.direction === dir).reduce((s, e) => s + e.amount, 0);
  const moneyIn = sum("in");
  const moneyOut = sum("out");
  // Delivered (HPP booked) but not fully paid.
  const unpaid = Object.values(orders.data ?? {})
    .filter((o) => o.cogs > 0 && o.paid < o.revenue)
    .sort((a, b) => b.revenue - b.paid - (a.revenue - a.paid));

  return (
    <Page
      title={t("nav.money")}
      actions={
        <Link href="/uang?aksi=keluar" className={primaryButton}>
          <Plus aria-hidden size={18} /> {t("expense.title")}
        </Link>
      }
    >
      <div role="tablist" className="flex gap-1 rounded-full bg-surface-muted p-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={p === period}
            onClick={() => setPeriod(p)}
            className={`min-h-touch flex-1 rounded-full font-medium ${
              p === period ? "bg-surface shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t(`money.period.${p}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t("money.in")} value={rupiah(moneyIn)} />
        <StatTile label={t("money.out")} value={rupiah(moneyOut)} />
        <StatTile
          label={t("money.net")}
          value={rupiah(moneyIn - moneyOut)}
          tone={moneyIn < moneyOut ? "warning" : undefined}
        />
      </div>

      <Section title={t("money.unpaid")}>
        {unpaid.length === 0 ? (
          <EmptyState>{t("money.noUnpaid")}</EmptyState>
        ) : (
          unpaid.map((o) => (
            <Link
              key={o.cardId}
              href={`/kartu?id=${o.cardId}`}
              className="flex min-h-touch items-center justify-between rounded-lg border border-border bg-surface p-3"
            >
              <span className="font-semibold">
                {o.title} #{o.number}
              </span>
              <span className="text-warning tabular-nums">{rupiah(o.revenue - o.paid)}</span>
            </Link>
          ))
        )}
      </Section>

      <Section title={t("money.entries")}>
        {entries.isPending ? (
          <EmptyState>{t("auth.loading")}</EmptyState>
        ) : (entries.data ?? []).length === 0 ? (
          <EmptyState>{t("money.noEntries")}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {(entries.data ?? []).map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </ul>
        )}
      </Section>

      {params.get("aksi") === "keluar" && <ExpenseSheet onClose={() => router.replace("/uang")} />}
    </Page>
  );
}

function EntryRow({ entry: e }: { entry: MoneyEntry }) {
  const title = e.categoryName ?? tOr(`money.kind.${e.kind}`, e.kind);
  const detail = [e.partyName, e.note, e.method && tOr(`method.${e.method}`, e.method)]
    .filter(Boolean)
    .join(" · ");
  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{title}</span>
        <span className="truncate text-caption text-muted-foreground">
          {shortDate(e.occurredAt)} {time(e.occurredAt)}
          {detail && ` · ${detail}`}
        </span>
      </div>
      <span
        className={`tabular-nums ${e.direction === "in" ? "text-primary" : ""} ${
          e.reversed ? "line-through opacity-60" : ""
        }`}
      >
        {e.direction === "in" ? "+" : "−"} {rupiah(e.amount)}
      </span>
    </>
  );
  return (
    <li>
      {e.cardId ? (
        <Link href={`/kartu?id=${e.cardId}`} className="flex items-center gap-3 p-3">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 p-3">{body}</div>
      )}
    </li>
  );
}

export default function MoneyPage() {
  return (
    <Suspense>
      <MoneyScreen />
    </Suspense>
  );
}
