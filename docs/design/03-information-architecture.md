# Business Whiteboard: Information Architecture

**Status:** Draft v0.1 · 2026-09-29 · Step 3 of the roadmap
**Builds on:** `01-prd.md` (features), `02-design-system.md` (components, nav pattern)
**Defaults assumed until the owner decides:** placeholder name "Papan", Bahasa Indonesia first with English as a second locale, neutral brand with per-workspace accent color.

---

## 1. Organizing idea

Owners think in three questions, so the app is organized around them, not around modules:

| Question | Where it lives |
|---|---|
| "What do I need to do **now**?" | **Hari ini** (Today) |
| "Where is each **job** at?" | **Papan** (Boards: orders, production, purchases) |
| "What do I **have**, and am I **earning**?" | **Stok** and **Uang** (Money) |

Everything else (lists, reports, board setup, settings) sits one level down in **Lainnya** (More), because it is used weekly, not hourly.

## 2. Sitemap

```
Papan (app)
├── Onboarding (first run only)
│   ├── Masuk / Daftar (phone OTP)
│   ├── Buat usaha (workspace name, type)
│   ├── Pilih template (Telur Asin · Kosong · others later)
│   └── Isi awal (products & prices, opening stock, customers optional)
│
├── 1 Hari ini (Today) ─────────────────────── tab
│   ├── Summary tiles (orders today, to boil, to deliver, unpaid)
│   ├── Suggestions (combine batch, buy vs boil, reorder)
│   ├── Due list: pre-orders H-1, deliveries, batches, supplier returns
│   └── → opens Card detail / Batch / Lot
│
├── 2 Papan (Boards) ───────────────────────── tab
│   ├── Board switcher: Pesanan · Pre-order · Rebus · Pembelian · (custom)
│   ├── Board view: Kanban (default) · Daftar · Kalender · Alur (canvas, view-only on phone)
│   ├── Card detail
│   │   ├── Header: customer, qty, variant, amount, due
│   │   ├── Stage stepper + next action
│   │   ├── Tabs: Info · Stok · Uang · Riwayat
│   │   └── Linked cards (e.g. its production batch)
│   └── New card (sheet)
│
├── 3 Stok (Stock) ─────────────────────────── tab
│   ├── Overview per item: Mentah · Matang · Rusak · Dipesan (reserved)
│   ├── Lots (batches from supplier / production) with return countdown
│   ├── Movements (history, filterable)
│   └── Actions: Terima stok · Rebus · Catat rusak · Retur ke supplier · Stok opname
│
├── 4 Uang (Money) ─────────────────────────── tab
│   ├── Summary: masuk, keluar, laba (period switch Hari · Minggu · Bulan)
│   ├── Transactions list (filter: category, method, order)
│   ├── Belum dibayar (receivables)
│   └── Actions: Catat pembayaran · Catat pengeluaran · Ambil pribadi (owner draw)
│
├── 5 Lainnya (More) ───────────────────────── tab
│   ├── Daftar (Lists)
│   │   ├── Pelanggan (customers) → customer detail (orders, total, unpaid)
│   │   ├── Produk & harga
│   │   ├── Supplier
│   │   └── Custom lists
│   ├── Laporan (Reports)
│   │   ├── Laba rugi (P&L)
│   │   ├── Laba per pesanan / pelanggan / jenis pelanggan
│   │   ├── HPP & susut (loss) per batch
│   │   ├── Stok & lot
│   │   └── Export (spreadsheet / PDF)
│   ├── Atur papan (Board setup)
│   │   ├── Boards list → Board editor (canvas on web, stage list on phone)
│   │   │   ├── Stage settings (name, color, actions, required fields, who can move)
│   │   │   ├── Rules on arrows (RuleBuilder)
│   │   │   └── Versions & publish
│   │   ├── Card types & fields
│   │   └── Templates
│   ├── Pengaturan (Settings)
│   │   ├── Usaha (name, logo, accent color, currency, tray size)
│   │   ├── Biaya produksi (LPG per batch, expected loss, bonus eggs)
│   │   ├── Kategori uang (expense categories, payment methods)
│   │   ├── Anggota & peran (members, roles)
│   │   ├── Notifikasi
│   │   └── Bahasa, tema
│   └── Bantuan & akun
│
└── Global (available everywhere)
    ├── + Quick add (FAB): Pesanan · Pengeluaran · Terima stok · Rebus
    ├── Search (customers, orders, lots)
    ├── Notifications inbox
    └── Offline / sync banner
```

Depth rule: any daily task is at most **2 taps from a tab** (tab → item, or FAB → form).

## 3. Navigation model

| Platform | Primary nav | Secondary | Detail |
|---|---|---|---|
| Phone | Bottom tab bar (5) + FAB | Top segmented control / board switcher | Full-screen page; create/edit in bottom sheets |
| Tablet | Bottom bar or left rail | Same | Detail in a sheet over the list |
| Desktop | Left sidebar (5 items + Lists, Reports, Board setup expanded) | Top bar with search + notifications | Split view: list/board left, detail panel right |

Back behavior: Android hardware back closes sheet → then goes up one level → then exits from a tab root (Capacitor `App.addListener('backButton')`).

## 4. Content model (what the user navigates)

| Object | Plain name | Belongs to | Shown in |
|---|---|---|---|
| Workspace | Usaha | – | Settings |
| Board | Papan | Workspace | Papan tab, Board setup |
| Card | Pesanan / Batch / Pembelian (by card type) | Board | Board views, Today, Customer detail |
| Stage | Tahap | Board | Kanban columns, stepper |
| Customer / Supplier | Pelanggan / Supplier | Workspace | Lists, card header |
| Product / Item | Produk | Workspace | Lists, Stok |
| Stock state | Kondisi (Mentah/Matang/Rusak) | Item | Stok |
| Lot | Batch stok | Item | Stok → Lots, card Stok tab |
| Movement | Riwayat stok | Lot | Stok → Movements, card Stok tab |
| Money entry | Transaksi | Workspace (optionally a card) | Uang, card Uang tab |
| Report | Laporan | Workspace | Lainnya → Laporan |

Naming rule: the card type's name replaces "card" everywhere (a card on the order board is called **Pesanan**, on the boiling board **Batch rebus**). Users never see the words card, record, entity or ledger.

## 5. Screen inventory (MVP)

| # | Screen | Route | Type | Role |
|---|---|---|---|---|
| S01 | Login / OTP | `/masuk` | Page | All |
| S02 | Onboarding wizard | `/mulai` | Stepper | Owner |
| S03 | Hari ini | `/` | Tab root | All |
| S04 | Board | `/papan?b={boardId}&v=kanban` | Tab root | All |
| S05 | Card detail | `/kartu?id={cardId}` | Page / panel | All |
| S06 | New / edit card | sheet over current route | Sheet | All |
| S07 | Transition picker | sheet | Sheet | All |
| S08 | Stok overview | `/stok` | Tab root | All |
| S09 | Lot detail | `/stok/lot?id=` | Page | Owner |
| S10 | Movements | `/stok/riwayat` | Page | Owner |
| S11 | Receive / Boil / Damage / Return / Opname | sheets | Sheet | Owner (Boil: Staff too) |
| S12 | Uang overview | `/uang` | Tab root | Owner |
| S13 | Transactions | `/uang/transaksi` | Page | Owner |
| S14 | Receivables | `/uang/belum-bayar` | Page | Owner |
| S15 | Payment / Expense entry | sheets | Sheet | Owner (Staff: payment only) |
| S16 | Lainnya | `/lainnya` | Tab root | All |
| S17 | List (customers, products, suppliers) | `/daftar?t=pelanggan` | Page | All (read), Owner (edit) |
| S18 | List item detail | `/daftar/item?t=&id=` | Page | All |
| S19 | Reports hub + report | `/laporan?r=laba-rugi` | Page | Owner |
| S20 | Board setup list | `/atur/papan` | Page | Owner |
| S21 | Board editor | `/atur/papan/edit?id=` | Canvas (web) / list (phone) | Owner |
| S22 | Stage settings, Rule builder, Action picker | panels/sheets in S21 | Panel | Owner |
| S23 | Card types & fields | `/atur/jenis` | Page | Owner |
| S24 | Settings sections | `/pengaturan?s=usaha` | Page | Owner |
| S25 | Search | overlay | Overlay | All |
| S26 | Notifications | `/notifikasi` | Page | All |

**Routing note:** the app is a Next.js static export (so it can run inside Capacitor and on GitHub Pages). Static export can't generate a page per database id, so detail screens use **query params** (`/kartu?id=…`) instead of `/kartu/[id]`. Deep links from notifications use the same URLs.

## 6. Roles and visibility

| Area | Owner | Staff |
|---|---|---|
| Hari ini | Everything | Only their assigned stages/boards; no money tiles |
| Papan | All boards | Boards they are allowed on; can move cards only into stages they're allowed to |
| Stok | Full | View + Rebus + Catat rusak |
| Uang | Full | Hidden (except recording a payment on a delivered order, if enabled) |
| Laporan, Atur papan, Pengaturan | Full | Hidden |

## 7. Labels (id / en)

| id (default) | en |
|---|---|
| Hari ini | Today |
| Papan | Boards |
| Stok | Stock |
| Uang | Money |
| Lainnya | More |
| Pesanan · Pre-order | Order · Pre-order |
| Rebus · Batch rebus | Boil · Boiling batch |
| Mentah · Matang · Rusak · Dipesan | Unboiled · Boiled · Damaged · Reserved |
| Terima stok · Retur ke supplier | Receive stock · Return to supplier |
| Pembayaran · Pengeluaran · Belum dibayar | Payment · Expense · Unpaid |
| HPP · Laba · Susut | COGS · Profit · Loss |
| Atur papan · Tahap · Aturan · Aksi | Board setup · Stage · Rule · Action |

Terms are editable per workspace where they are business-specific (e.g. "Rebus" can become "Produksi" for another business); navigation labels are fixed.

## 8. Search, notifications, empty states

- **Search** covers customers (name, phone), cards (title, number), lots (date). Recent searches shown first. On phone it opens from the top bar of Hari ini and Papan.
- **Notifications** (push + inbox): pre-order H-1 boil reminder, delivery due, return window closing (H-1), unpaid after N days, low stock, sync failed. Each opens its object's route.
- **Empty states** always point to the next action (e.g. empty Stok → "Terima stok pertama").

## 9. Open IA questions

1. Should **Pre-order** be its own board (current) or a stage path inside the Pesanan board? Separate boards are clearer; one board shows all orders in one place.
2. Does Staff exist in the pilot, or only Ibu & Ayah as owners? (If only owners, roles can be deferred to M2.)
