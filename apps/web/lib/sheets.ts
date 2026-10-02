// Laporan to Google Sheets, from the browser. Tapping Sinkron signs in with Google again to get a
// short-lived Drive token (scope drive.file: only files EggSalt creates), then the app rewrites the
// workspace's spreadsheet: Mingguan, Bulanan and Pesanan, all history. Same rules as Laporan: an
// order counts on the day its eggs left stock, expenses on their own date, except costs booked on
// production batches and purchases, which already sit in HPP.

import { dayKey } from "@/lib/format";
import { signInWithDriveAccess } from "@/lib/google-sign-in";
import { t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const PENDING = "eggsalt.sheets.pending";
const URL_KEY = "eggsalt.sheets.url.";
const TABS = ["Mingguan", "Bulanan", "Pesanan"] as const;
const DRIVE = "https://www.googleapis.com/drive/v3/files";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

function store(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** Remembers which workspace to sync, then leaves for Google; the sync runs on the way back. */
export async function startSheetsSync(workspaceId: string): Promise<void> {
  store()?.setItem(PENDING, workspaceId);
  await signInWithDriveAccess();
}

/** The workspace waiting for a sync after the Google round trip, cleared once read. */
export function takePendingSync(): string | null {
  const id = store()?.getItem(PENDING) ?? null;
  store()?.removeItem(PENDING);
  return id;
}

/** Link to the workspace's spreadsheet on this device, once it has been synced here. */
export function sheetUrl(workspaceId: string): string | null {
  return store()?.getItem(URL_KEY + workspaceId) ?? null;
}

export class SheetsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function google<T>(token: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new SheetsError(json.error?.message ?? `Google ${res.status}`, res.status);
  return json as T;
}

/** The workspace's spreadsheet, found by a tag on the file, or a new one with the three tabs. */
async function spreadsheet(token: string, workspaceId: string, name: string): Promise<string> {
  const q = `appProperties has { key='eggsaltWorkspace' and value='${workspaceId}' } and trashed=false`;
  const found = await google<{ files: { id: string }[] }>(
    token,
    `${DRIVE}?q=${encodeURIComponent(q)}&fields=files(id)`,
  );
  if (found.files[0]) {
    const id = found.files[0].id;
    const meta = await google<{ sheets: { properties: { title: string } }[] }>(
      token,
      `${SHEETS}/${id}?fields=sheets.properties.title`,
    );
    const have = meta.sheets.map((s) => s.properties.title);
    const missing = TABS.filter((tab) => !have.includes(tab));
    if (missing.length) {
      await google(token, `${SHEETS}/${id}:batchUpdate`, {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      });
    }
    return id;
  }
  const file = await google<{ id: string }>(token, DRIVE, {
    name: `EggSalt - ${t("report.title")} ${name}`,
    mimeType: "application/vnd.google-apps.spreadsheet",
    appProperties: { eggsaltWorkspace: workspaceId },
  });
  // A new spreadsheet has one empty tab (sheetId 0): rename it and add the other two.
  await google(token, `${SHEETS}/${file.id}:batchUpdate`, {
    requests: [
      { updateSheetProperties: { properties: { sheetId: 0, title: TABS[0] }, fields: "title" } },
      ...TABS.slice(1).map((title) => ({ addSheet: { properties: { title } } })),
    ],
  });
  return file.id;
}

/** Every row of a query, page by page (the API returns at most 1000 at a time). */
async function all<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

interface Sold {
  day: string;
  number: number;
  title: string;
  party: string;
  revenue: number;
  cogs: number;
  direct: number;
  profit: number;
}

async function load(workspaceId: string) {
  const db = supabase();
  const [moves, profits, cards, spend] = await Promise.all([
    all<{
      id: string;
      card_id: string;
      created_at: string;
      reason: string;
      reverses_id: string | null;
    }>((a, b) =>
      db
        .from("stock_movement")
        .select("id, card_id, created_at, reason, reverses_id")
        .eq("workspace_id", workspaceId)
        .in("reason", ["sale", "reversal"])
        .not("card_id", "is", null)
        .order("created_at")
        .range(a, b),
    ),
    all<{
      card_id: string;
      number: number;
      title: string;
      revenue: number;
      cogs: number;
      direct_costs: number;
      profit: number;
    }>((a, b) =>
      db
        .from("v_order_profit")
        .select("card_id, number, title, revenue, cogs, direct_costs, profit")
        .eq("workspace_id", workspaceId)
        .range(a, b),
    ),
    all<{ id: string; party: { name: string } | null }>((a, b) =>
      db.from("card").select("id, party (name)").eq("workspace_id", workspaceId).range(a, b),
    ),
    all<{
      id: string;
      kind: string;
      amount: number;
      card_id: string | null;
      reverses_id: string | null;
      occurred_at: string;
    }>((a, b) =>
      db
        .from("money_entry")
        .select("id, kind, amount, card_id, reverses_id, occurred_at")
        .eq("workspace_id", workspaceId)
        .in("kind", ["expense", "reversal"])
        .range(a, b),
    ),
  ]);

  const profitOf = new Map(profits.map((p) => [p.card_id, p]));
  const partyOf = new Map(cards.map((c) => [c.id, c.party?.name ?? ""]));
  const undone = new Set(moves.map((m) => m.reverses_id).filter(Boolean));
  const soldOn = new Map<string, string>();
  for (const m of moves) {
    if (m.reason !== "sale" || undone.has(m.id) || soldOn.has(m.card_id)) continue;
    soldOn.set(m.card_id, dayKey(m.created_at));
  }
  const sold: Sold[] = [...soldOn].flatMap(([cardId, day]) => {
    const p = profitOf.get(cardId);
    return p
      ? [
          {
            day,
            number: p.number,
            title: p.title,
            party: partyOf.get(cardId) ?? "",
            revenue: Number(p.revenue),
            cogs: Number(p.cogs),
            direct: Number(p.direct_costs),
            profit: Number(p.profit),
          },
        ]
      : [];
  });

  const cancelled = new Set(spend.map((e) => e.reverses_id).filter(Boolean));
  const spent = spend
    .filter(
      (e) =>
        e.kind === "expense" && !cancelled.has(e.id) && (!e.card_id || profitOf.has(e.card_id)),
    )
    .map((e) => ({ day: dayKey(e.occurred_at), amount: Number(e.amount) }));
  return { sold, spent };
}

/** Monday of the week a YYYY-MM-DD day falls in. */
function weekOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function totals(
  sold: Sold[],
  spent: { day: string; amount: number }[],
  periodOf: (day: string) => string,
): (string | number)[][] {
  const rows = new Map<string, { orders: number; revenue: number; cogs: number; spent: number }>();
  const row = (key: string) => {
    let r = rows.get(key);
    if (!r) rows.set(key, (r = { orders: 0, revenue: 0, cogs: 0, spent: 0 }));
    return r;
  };
  for (const s of sold) {
    const r = row(periodOf(s.day));
    r.orders += 1;
    r.revenue += s.revenue;
    r.cogs += s.cogs;
  }
  for (const e of spent) row(periodOf(e.day)).spent += e.amount;
  return [...rows]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, r]) => [
      key,
      r.orders,
      r.revenue,
      r.cogs,
      r.revenue - r.cogs,
      r.spent,
      r.revenue - r.cogs - r.spent,
    ]);
}

async function rows(workspaceId: string) {
  const { sold, spent } = await load(workspaceId);
  const head = [
    t("export.orders"),
    t("profit.revenue"),
    t("profit.cogs"),
    t("report.gross"),
    t("export.expenses"),
    t("report.net"),
  ];
  return [
    { tab: TABS[0], values: [[t("export.weekOf"), ...head], ...totals(sold, spent, weekOf)] },
    {
      tab: TABS[1],
      values: [[t("export.month"), ...head], ...totals(sold, spent, (d) => d.slice(0, 7))],
    },
    {
      tab: TABS[2],
      values: [
        [
          t("export.date"),
          t("export.number"),
          t("export.order"),
          t("export.customer"),
          t("profit.revenue"),
          t("profit.cogs"),
          t("profit.direct"),
          t("profit.profit"),
        ],
        ...[...sold]
          .sort((a, b) => b.day.localeCompare(a.day) || b.number - a.number)
          .map((s) => [s.day, s.number, s.title, s.party, s.revenue, s.cogs, s.direct, s.profit]),
      ],
    },
  ];
}

/** Rewrites the workspace's spreadsheet from scratch and returns its link. */
export async function syncSheets(
  token: string,
  workspaceId: string,
  name: string,
): Promise<string> {
  const id = await spreadsheet(token, workspaceId, name);
  const data = await rows(workspaceId);
  await google(token, `${SHEETS}/${id}/values:batchClear`, {
    ranges: data.map((d) => `'${d.tab}'`),
  });
  await google(token, `${SHEETS}/${id}/values:batchUpdate`, {
    valueInputOption: "RAW",
    data: data.map((d) => ({ range: `'${d.tab}'!A1`, values: d.values })),
  });
  const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  store()?.setItem(URL_KEY + workspaceId, url);
  return url;
}
