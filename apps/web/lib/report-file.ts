// Laporan as an Excel file: a profit and loss sheet (with expenses by category) and one row per
// order. Money is whole rupiah stored as numbers, so sums and charts work in Excel or Sheets.
import { dayKey } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { ProfitReport } from "@/lib/queries";
import { downloadXlsx } from "@/lib/xlsx";

/** Saves the report as laporan-<period>-<date>.xlsx on this device. */
export function downloadReport(report: ProfitReport, periodName: string, fileKey: string) {
  const revenue = report.orders.reduce((s, o) => s + o.revenue, 0);
  const cogs = report.orders.reduce((s, o) => s + o.cogs, 0);
  const spent = report.expenses.reduce((s, e) => s + e.amount, 0);
  downloadXlsx(`laporan-${fileKey}-${dayKey()}.xlsx`, [
    {
      name: t("report.laba-rugi"),
      widths: [28, 16],
      rows: [
        [t("report.title"), periodName],
        [t("export.madeOn"), dayKey()],
        [],
        [t("profit.revenue"), revenue],
        [t("profit.cogs"), cogs],
        [t("report.gross"), revenue - cogs],
        ...report.expenses.map((e): (string | number)[] => [e.name, e.amount]),
        [t("report.net"), revenue - cogs - spent],
      ],
    },
    {
      name: t("report.pesanan"),
      widths: [6, 28, 22, 14, 14, 14, 14],
      rows: [
        [
          t("export.number"),
          t("export.order"),
          t("export.customer"),
          t("profit.revenue"),
          t("profit.cogs"),
          t("profit.direct"),
          t("profit.profit"),
        ],
        ...report.orders.map((o): (string | number)[] => [
          o.number,
          o.title,
          o.partyName ?? t("report.noCustomer"),
          o.revenue,
          o.cogs,
          o.directCosts,
          o.profit,
        ]),
      ],
    },
  ]);
}
