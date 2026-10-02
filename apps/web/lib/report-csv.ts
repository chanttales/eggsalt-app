// Laporan as a CSV file that Excel and Google Sheets open: profit and loss, expenses by
// category, then one row per order. Money is whole rupiah without separators so sums work.
import { dayKey } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { ProfitReport } from "@/lib/queries";

const SEP = ";";

function cell(value: string | number): string {
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rows(report: ProfitReport, periodName: string): (string | number)[][] {
  const revenue = report.orders.reduce((s, o) => s + o.revenue, 0);
  const cogs = report.orders.reduce((s, o) => s + o.cogs, 0);
  const spent = report.expenses.reduce((s, e) => s + e.amount, 0);
  return [
    [t("report.title"), periodName],
    [t("export.madeOn"), dayKey()],
    [],
    [t("report.laba-rugi")],
    [t("profit.revenue"), revenue],
    [t("profit.cogs"), cogs],
    [t("report.gross"), revenue - cogs],
    ...report.expenses.map((e) => [e.name, e.amount]),
    [t("report.net"), revenue - cogs - spent],
    [],
    [t("report.pesanan")],
    [
      t("export.number"),
      t("export.order"),
      t("export.customer"),
      t("profit.revenue"),
      t("profit.cogs"),
      t("profit.direct"),
      t("profit.profit"),
    ],
    ...report.orders.map((o) => [
      o.number,
      o.title,
      o.partyName ?? t("report.noCustomer"),
      o.revenue,
      o.cogs,
      o.directCosts,
      o.profit,
    ]),
  ];
}

/** Saves the report as laporan-<period>-<date>.csv on this device. */
export function downloadReportCsv(report: ProfitReport, periodName: string, fileKey: string) {
  const text = rows(report, periodName)
    .map((r) => r.map(cell).join(SEP))
    .join("\r\n");
  // The BOM makes Excel read the file as UTF-8.
  const blob = new Blob(["﻿", text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laporan-${fileKey}-${dayKey()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
