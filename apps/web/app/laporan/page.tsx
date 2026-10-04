"use client";

import { Download, ExternalLink, Sheet } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { EmptyState, Page, Section, ListSkeleton, secondaryButton } from "@/components/ui";
import { PERIODS, periodStart, rupiah, type Period } from "@/lib/format";
import { t, tOr } from "@/lib/i18n";
import { useProfitReport, type OrderProfit } from "@/lib/queries";
import { downloadReport } from "@/lib/report-file";
import { sheetUrl, startSheetsSync } from "@/lib/sheets";
import { useSession } from "@/lib/session";

const REPORTS = ["laba-rugi", "pesanan", "pelanggan"] as const;
type Report = (typeof REPORTS)[number];

// Laporan: profit and loss for the period, then profit per order and per customer, with
// losing orders first so they stand out.
function ReportScreen() {
  const params = useSearchParams();
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";
  const report = (REPORTS as readonly string[]).includes(params.get("r") ?? "")
    ? (params.get("r") as Report)
    : "laba-rugi";
  const [period, setPeriod] = useState<Period>("month");
  const data = useProfitReport(periodStart(period));

  if (!isOwner) {
    return (
      <Page back guide="laporan" title={t("report.title")}>
        <EmptyState>{t("money.ownerOnly")}</EmptyState>
      </Page>
    );
  }

  return (
    <Page back guide="laporan" title={t("report.title")}>
      <Segmented
        label={t("report.title")}
        options={REPORTS}
        value={report}
        onChange={(r) => window.history.replaceState(null, "", `?r=${r}`)}
        name={(r) => t(`report.${r}`)}
      />
      <Segmented
        label={t("report.period")}
        options={PERIODS}
        value={period}
        onChange={setPeriod}
        name={(p) => t(`money.period.${p}`)}
      />
      {data.isPending ? (
        <ListSkeleton />
      ) : !data.data ? (
        <EmptyState>{t("report.failed")}</EmptyState>
      ) : report === "laba-rugi" ? (
        <ProfitAndLoss orders={data.data.orders} expenses={data.data.expenses} />
      ) : report === "pesanan" ? (
        <PerOrder orders={data.data.orders} />
      ) : (
        <PerCustomer orders={data.data.orders} />
      )}
      {data.data && (
        <button
          type="button"
          onClick={() =>
            data.data && downloadReport(data.data, t(`money.period.${period}`), period)
          }
          className={secondaryButton}
        >
          <Download aria-hidden size={18} />
          {t("export.download")}
        </button>
      )}
      {state.status === "signed_in" && state.workspace && (
        <SheetsBox workspaceId={state.workspace.id} />
      )}
    </Page>
  );
}

// Google Sheets: Sinkron goes to Google for a Drive token and the app writes the sheet on return.
function SheetsBox({ workspaceId }: { workspaceId: string }) {
  const [busy, setBusy] = useState(false);
  const url = sheetUrl(workspaceId);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void startSheetsSync(workspaceId).catch(() => setBusy(false));
        }}
        className={secondaryButton}
      >
        <Sheet aria-hidden size={18} />
        {t("sheets.sync")}
      </button>
      <p className="text-label text-muted-foreground">{t("sheets.hint")}</p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 self-start text-label font-semibold text-primary"
        >
          <ExternalLink aria-hidden size={16} />
          {t("sheets.open")}
        </a>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  name,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  name: (v: T) => string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-full bg-surface-muted p-1">
      {options.map((o) => (
        <button
          key={o}
          role="tab"
          aria-selected={o === value}
          onClick={() => onChange(o)}
          className={`min-h-touch flex-1 rounded-full text-label font-medium ${
            o === value ? "bg-surface shadow-sm" : "text-muted-foreground"
          }`}
        >
          {name(o)}
        </button>
      ))}
    </div>
  );
}

function Line({
  label,
  value,
  strong,
  negative,
}: {
  label: string;
  value: number;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-2 ${strong ? "border-t border-border pt-2 font-bold" : ""}`}
    >
      <dt>{label}</dt>
      <dd className={`tabular-nums ${value < 0 ? "text-danger" : ""}`}>
        {negative ? `− ${rupiah(value)}` : rupiah(value)}
      </dd>
    </div>
  );
}

function ProfitAndLoss({
  orders,
  expenses,
}: {
  orders: OrderProfit[];
  expenses: { name: string; amount: number }[];
}) {
  const revenue = orders.reduce((s, o) => s + o.revenue, 0);
  const cogs = orders.reduce((s, o) => s + o.cogs, 0);
  const gross = revenue - cogs;
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const net = gross - spent;
  const pct = (n: number) => (revenue > 0 ? ` (${Math.round((n / revenue) * 100)}%)` : "");
  return (
    <dl className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <Line
        label={`${t("profit.revenue")} · ${orders.length} ${t("report.orders")}`}
        value={revenue}
      />
      <Line label={t("profit.cogs")} value={cogs} negative />
      <Line label={`${t("report.gross")}${pct(gross)}`} value={gross} strong />
      {expenses.map((e) => (
        <Line key={e.name} label={e.name || t("money.kind.expense")} value={e.amount} negative />
      ))}
      <Line label={`${t("report.net")}${pct(net)}`} value={net} strong />
    </dl>
  );
}

function PerOrder({ orders }: { orders: OrderProfit[] }) {
  if (orders.length === 0) return <EmptyState>{t("report.noSales")}</EmptyState>;
  const sorted = [...orders].sort((a, b) => a.profit - b.profit);
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      {sorted.map((o) => (
        <li key={o.cardId}>
          <Link href={`/kartu?id=${o.cardId}`} className="flex items-center gap-3 p-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">
                {o.title} #{o.number}
              </span>
              <span className="text-caption text-muted-foreground">
                {rupiah(o.revenue)} − {rupiah(o.cogs + o.directCosts)}
              </span>
            </div>
            <span className={`font-semibold tabular-nums ${o.profit < 0 ? "text-danger" : ""}`}>
              {rupiah(o.profit)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function group(orders: OrderProfit[], key: (o: OrderProfit) => string) {
  const map = new Map<string, { name: string; count: number; revenue: number; profit: number }>();
  for (const o of orders) {
    const k = key(o);
    const g = map.get(k) ?? { name: k, count: 0, revenue: 0, profit: 0 };
    g.count += 1;
    g.revenue += o.revenue;
    g.profit += o.profit;
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.profit - a.profit);
}

function PerCustomer({ orders }: { orders: OrderProfit[] }) {
  if (orders.length === 0) return <EmptyState>{t("report.noSales")}</EmptyState>;
  const none = t("report.noCustomer");
  const segments = group(orders, (o) =>
    o.segment ? tOr(`segment.${o.segment}`, o.segment) : none,
  );
  const customers = group(orders, (o) => o.partyName ?? none);
  return (
    <>
      <Section title={t("report.bySegment")}>
        <GroupTable rows={segments} />
      </Section>
      <Section title={t("report.byCustomer")}>
        <GroupTable rows={customers} />
      </Section>
    </>
  );
}

function GroupTable({ rows }: { rows: ReturnType<typeof group> }) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      {rows.map((r) => (
        <li key={r.name} className="flex items-center gap-3 p-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{r.name}</span>
            <span className="text-caption text-muted-foreground">
              {r.count} {t("report.orders")} · {rupiah(r.revenue)}
            </span>
          </div>
          <span className={`font-semibold tabular-nums ${r.profit < 0 ? "text-danger" : ""}`}>
            {rupiah(r.profit)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportPage() {
  return (
    <Suspense>
      <ReportScreen />
    </Suspense>
  );
}
