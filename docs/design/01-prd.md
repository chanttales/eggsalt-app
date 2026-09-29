# Business Whiteboard — Product Requirements (PRD)

**Status:** Draft v0.1 · 2026-09-29
**Reference business:** Bisnis Telur Asin (Ibu & Ayah), started 2026-08-03
**Platforms:** Web (Next.js) and Android/iOS (CapacitorJS)

---

## 1. Problem

Small family businesses like Bisnis Telur Asin run on memory, WhatsApp and egg trays. The owners can't easily answer:

- "Do we have enough boiled eggs for tomorrow's catering order?"
- "Which eggs must go back to the supplier before the 5-day return window closes?"
- "Did that 100-egg catering order actually make money after LPG and delivery?"
- "How much did we really earn this month?"

Off-the-shelf ERP/POS apps force a fixed process (quotation → SO → DO → invoice) that doesn't match how a two-person business works, and they are too heavy on a phone.

## 2. Product vision

A **business whiteboard**: the owner draws how their business actually works (stages, branches, rules) and the app turns that drawing into a working system that tracks orders, stock and money. When the business changes, they redraw the board instead of fighting the software.

Principles (from the project brief): **flexible, customizable, mobile-friendly, simple.**

Design consequence: *flexible where the business differs, strict where correctness matters.* Stages, fields, rules and screens are customizable. Stock counts and money are always recorded as a proper ledger, so reports stay trustworthy however the board is drawn.

## 3. Users

| Persona | Device | Needs |
|---|---|---|
| **Owner-operator** (Ibu) | Phone, mostly | Take orders fast, see today's work, know stock, record payments |
| **Owner-operator** (Ayah) | Phone on the road, laptop at home | Deliveries, supplier purchases, boiling, costs; edit the board |
| **Future staff / helper** | Phone | Do assigned steps only (boil, deliver), no finance access |

Target market beyond the reference business: micro and small businesses (UMKM) with 1 to 10 people, selling physical goods with light production.

## 4. Core concepts (what the user sees)

| Concept | Plain meaning | Egg business example |
|---|---|---|
| **Board** | A drawn workflow: stages joined by arrows | "Order Warung", "Pre-order Catering", "Production (Boiling)" |
| **Card** | One thing moving through a board | Order #012 for Warung Bu Siti, 20 eggs |
| **Stage** | A column/box a card sits in | Baru → Cek Stok → Disiapkan → Dikirim → Lunas |
| **Rule** | "If … then go this way" on an arrow | If qty ≥ 100 or customer is Catering → Pre-order path |
| **Step action** | Something that happens automatically when a card enters a stage | Entering "Dikirim" deducts 20 boiled eggs from stock |
| **List** | A table of things with custom fields | Customers, Products, Suppliers |
| **Stock** | Quantities of an item in a state | Telur mentah: 140 · Telur matang: 35 · Rusak: 2 |
| **Money** | Every rupiah in or out, tagged | Purchase, LPG, delivery, sale, payment |
| **Template** | A ready-made set of boards, lists and stock setup | "Telur Asin" template = this PRD's example |

## 5. Requirements

Priority: **P0** = MVP, **P1** = soon after, **P2** = later.

### 5.1 Workflow whiteboard (the differentiator)

| ID | Requirement | P |
|---|---|---|
| WB-1 | Visual editor: add/rename/reorder stages, draw arrows between them, drag on canvas (web) | P0 |
| WB-2 | Each board has a card type (Order, Production batch, Purchase, Delivery, or custom) | P0 |
| WB-3 | Rules on arrows using simple conditions (field, comparison, value; AND/OR) | P0 |
| WB-4 | Step actions from a fixed catalog (see 5.8), configured with forms, not code | P0 |
| WB-5 | Same board shown as **Kanban** (default, mobile-friendly), **List**, and **Flow canvas** | P0 |
| WB-6 | Start from a template, then change anything | P0 |
| WB-7 | Editing a board never breaks cards already in progress (board versions) | P0 |
| WB-8 | Skip/undo a step with a reason (no rigid enforcement unless the owner asks for it) | P0 |
| WB-9 | Required fields per stage ("can't mark Dikirim without delivery cost") — optional per stage | P1 |
| WB-10 | Linked boards: an order card can spawn a production card and wait for it | P1 |
| WB-11 | Mobile board editing (rename, reorder, simple rules); full canvas stays web-first | P1 |
| WB-12 | Share/duplicate templates between workspaces; community templates | P2 |

### 5.2 Orders & customers

| ID | Requirement | P |
|---|---|---|
| OR-1 | Create order in ≤ 3 taps from phone: customer, product variant, quantity | P0 |
| OR-2 | Customer list with type (Warung, Acara/Catering, custom), phone, address, notes | P0 |
| OR-3 | Quick-quantity chips from typical quantities (10, 15, 20, 25, 40, 100) | P0 |
| OR-4 | Price per customer type and per variant (mentah/matang), overridable per order | P0 |
| OR-5 | Pre-order: due date, lead-time rule (Catering recommended H-1), reserves stock | P0 |
| OR-6 | Stock check on order: shows available vs. reserved vs. needs boiling | P0 |
| OR-7 | Shortage branch: Warung → reschedule (new date); Catering → note "customer buys extra from supplier" or buy boiled eggs to fulfill | P0 |
| OR-8 | Order history and repeat order per customer | P1 |
| OR-9 | Receivables: unpaid / partially paid orders, "tempo" per warung | P1 |
| OR-10 | Share order summary / receipt via WhatsApp | P1 |

### 5.3 Inventory

| ID | Requirement | P |
|---|---|---|
| IN-1 | Items with **states**: Telur mentah (unboiled), Telur matang (boiled), Rusak/gagal (damaged) | P0 |
| IN-2 | Receive from supplier creates a **lot** (date, qty, unit cost, return-by date) | P0 |
| IN-3 | Stock view in eggs and in trays (configurable tray size, default 30) | P0 |
| IN-4 | Every change is a movement (receive, boil, damage, sell, return, adjust); no silent edits | P0 |
| IN-5 | **Return policy (owner rule): any unboiled eggs still in a lot on day 5 go back to the supplier, to reduce risk.** The app treats this as the default, not an exception: a return task is created automatically for each lot on day 5 (reminder on day 4), prefilled with the lot's unreserved remaining qty | P0 |
| IN-5a | FIFO everywhere: orders and boiling always take the oldest lot first, so the fewest eggs reach the return date | P0 |
| IN-5b | Warn before boiling or reserving from a lot that is due for return in ≤ 1 day ("Batch ini harus diretur besok: pakai atau retur?"). Boiled eggs cannot be returned | P0 |
| IN-5c | Purchase suggestion accounts for the 5-day window: suggest a quantity close to expected demand for the next 5 days (≥ minimum 100) to keep returns small | P1 |
| IN-6 | Return to supplier reduces stock and records the refund/credit | P0 |
| IN-7 | Low-stock and reorder suggestion (min purchase 100, usual 200) | P1 |
| IN-8 | Stock opname (count and reconcile) with difference posted as adjustment | P1 |

### 5.4 Production (boiling)

| ID | Requirement | P |
|---|---|---|
| PR-1 | Production batch: input N mentah → output good matang + damaged | P0 |
| PR-2 | Suggest batch size from open orders due soon minus boiled stock on hand | P0 |
| PR-3 | Record batch costs (LPG, other) and flag "urgent" batches | P0 |
| PR-4 | Batch cost flows into the unit cost of the boiled eggs it produced | P0 |
| PR-5 | Loss tracking: expected vs. actual damage per batch, trend over time | P1 |

### 5.5 Delivery

| ID | Requirement | P |
|---|---|---|
| DL-1 | Delivery or pickup per order; status (Dijadwalkan, Dalam perjalanan, Terkirim, Gagal) | P0 |
| DL-2 | Delivery cost per order, and trip cost split across several orders on one trip | P0 |
| DL-3 | Today's delivery list with address and a map link | P1 |
| DL-4 | Proof of delivery (photo, note) | P2 |

### 5.6 Money: expenses, HPP, revenue, profit

| ID | Requirement | P |
|---|---|---|
| FI-1 | Expense entry with category: Pembelian, LPG, Pengiriman, Akomodasi, Lainnya (custom categories allowed) | P0 |
| FI-2 | Payment entry against an order (cash / transfer / QRIS), partial payments | P0 |
| FI-3 | **HPP per unit** computed automatically from lot purchase cost + batch costs + losses | P0 |
| FI-4 | **Profit per order** = revenue − HPP of eggs sold − that order's delivery cost − any direct cost | P0 |
| FI-5 | Business profit for a period = revenue − HPP − operating expenses not tied to orders | P0 |
| FI-6 | Cash position: money in vs. money out, by method | P1 |
| FI-7 | Owners' personal withdrawals kept separate from business expenses (prive) | P1 |

### 5.7 Reports

| ID | Report | P |
|---|---|---|
| RP-1 | Today: orders due, deliveries, batches to boil, returns due, unpaid | P0 |
| RP-2 | Profit & loss by period (day/week/month) | P0 |
| RP-3 | Profit per order and per customer / customer type (Warung vs. Catering) | P0 |
| RP-4 | Stock on hand by state and lot, with return deadlines | P0 |
| RP-5 | HPP trend and loss rate per batch | P1 |
| RP-6 | Seasonal view (e.g. demand around Maulid Nabi) to plan purchases | P2 |
| RP-7 | Export to spreadsheet / PDF | P1 |

### 5.8 Step-action catalog (MVP)

These are the building blocks a stage can run. The owner picks them from a list; no code.

| Action | What it does | Egg example |
|---|---|---|
| Set field | Set or calculate a field | total = qty × price |
| Reserve stock | Hold stock for this card | Pre-order reserves 100 matang |
| Release reservation | Undo a hold | Order cancelled |
| Move stock | Take stock out / change its state | Delivered: −20 matang |
| Create linked card | Start a card on another board | Shortage → create Production batch for 30 |
| Record money | Post revenue, payment or expense | Paid → payment Rp 70.000 |
| Remind | Reminder at a time or offset | H-1 before catering date |
| Require | Block moving on until a field is filled | Delivery cost before "Terkirim" |

### 5.9 Platform & UX

| ID | Requirement | P |
|---|---|---|
| UX-1 | Mobile-first layout; every daily task one-handed on a phone | P0 |
| UX-2 | Bahasa Indonesia first, English second; Rupiah formatting (Rp 2.300) | P0 |
| UX-3 | Works on slow/unstable connections: queued writes sync later | P0 |
| UX-4 | Two owners on one workspace, changes visible to both | P0 |
| UX-5 | Roles: Owner (all), Staff (assigned boards, no money reports) | P1 |
| UX-6 | Android app via Capacitor; iOS after | P0 (Android) / P1 (iOS) |
| UX-7 | Full offline mode (create orders, move cards without signal) | P1 |

## 6. Reference example: how Bisnis Telur Asin is configured

The "Telur Asin" template ships these pieces. All of them are editable.

**Lists:** Customers (type: Warung / Acara-Catering), Products (Telur asin mentah, Telur asin matang), Supplier (1).

**Stock:** item *Telur asin bebek* with states Mentah → Matang → Rusak; unit egg; tray = 30.

**Board A — Order (standard, mainly Warung)**
`Baru → Cek stok → [Perlu rebus?] → Disiapkan → Dikirim/Diambil → Dibayar → Selesai`
- Enter *Cek stok*: show available matang; rule: if not enough → *Create linked card* (Production) or → *Dijadwal ulang* (Warung reschedule).
- Enter *Dikirim*: *Move stock* −qty matang; require delivery cost.
- Enter *Dibayar*: *Record money* (payment).
- Enter *Selesai*: profit is computed automatically.

**Board B — Pre-order (Catering / ≥ 100 eggs)**
`Pre-order diterima → Stok dipesan → Rebus (H-1) → Siap → Dikirim → Dibayar → Selesai`
- Entry rule: customer type = Catering **or** qty ≥ 100.
- Enter *Stok dipesan*: *Reserve stock* (mentah); if short → buy from supplier or note customer buys extra from supplier.
- *Remind* H-1 at 08:00: "Rebus 100 telur untuk acara Bu Rina".

**Board C — Production (Rebus)**
`Rencana → Direbus → Sortir → Siap`
- Enter *Sortir*: input good vs. damaged; *Move stock* mentah → matang and mentah → rusak; record LPG cost; urgent flag adds extra LPG.

**Board D — Supplier purchase & return**
`Dipesan → Diterima (lot created, return-by = +5 days) → [Sisa?] → Dikembalikan`

### Worked HPP example (owner-confirmed numbers, 2026-09-29)

**Confirmed by owners**

| Input | Value |
|---|---|
| Selling price | Mentah Rp 3.300 · Matang Rp 3.500 per egg |
| Supplier price | Mentah Rp 2.300 · Matang Rp 2.500 per egg |
| Supplier bonus | +5 free eggs every purchase |
| Production loss | ~2 eggs per batch (mleyot/rusak, usually eaten at home) |
| Boiling time | 10 eggs ≈ 10 min · 60 eggs ≈ 30 min |
| LPG per batch | **Not known yet** |

**Step 1: real cost of an unboiled egg (bonus included)**
Buy 200 → receive 205. Cost 200 × 2.300 = 460.000 ÷ 205 = **Rp 2.244 per egg** (not 2.300).

**Step 2: LPG estimate (to replace with a real number)**
Assumption: 3 kg tabung ≈ Rp 20.000 and a normal stove burns ≈ 0,2 kg/hour. Then 30 min ≈ Rp 700 and 10 min ≈ Rp 250. The docs round up to **Rp 1.000 for a 60-egg batch** and Rp 250 for a 10-egg batch.
Simplest way for the owners to get the real number: count how many batches one tabung lasts. LPG per batch = tabung price ÷ batches.

**Step 3: HPP per boiled egg by batch size** (2 eggs lost per batch)

| Batch | LPG (est.) | Good eggs | HPP matang | Margin at Rp 3.500 |
|---|---|---|---|---|
| 10 | 250 | 8 | Rp 2.836 | Rp 664 (19%) |
| 20 | 500 | 18 | Rp 2.521 | Rp 979 (28%) |
| 30 | 500 | 28 | Rp 2.422 | Rp 1.078 (31%) |
| 60 | 1.000 | 58 | Rp 2.339 | Rp 1.161 (33%) |
| Buy matang from supplier | – | – | Rp 2.500 | Rp 1.000 (29%) |
| Sell mentah (no boiling) | – | – | Rp 2.244 | Rp 1.056 (32%) |

**What this tells the owners**
- The 2 lost eggs are the biggest cost of small batches, far more than LPG. A 10-egg batch loses 20% of its eggs.
- Boiling beats buying boiled eggs from the supplier once a batch has **about 24 eggs or more** (2.244·n + LPG ≤ 2.500·(n − 2) → n ≥ (LPG + 5.000) ÷ 256). Below that, buying matang at Rp 2.500 is cheaper.
- So boiling "sesuai kebutuhan" is right, but it pays to **group orders into batches of 30 to 60** instead of boiling 10 at a time. The app should suggest this ("Gabungkan: 3 pesanan besok = 55 telur, rebus sekali").
- Capacity: about 60 eggs per 30 minutes, so a 100-egg catering order needs 2 batches, roughly 1 hour of boiling. The pre-order board should plan this on H-1.

**Example order profits** (delivery costs are assumed; the owners haven't given them yet)
- Warung, 20 matang: 70.000 − HPP 46.780 (20 × 2.339) − delivery 5.000 = **Rp 18.220 (26%)**
- Warung, 20 mentah: 66.000 − HPP 44.880 − delivery 5.000 = **Rp 16.120 (24%)**
- Catering, 100 matang: 350.000 − HPP ≈ 233.900 − delivery 10.000 = **Rp 106.100 (30%)**

Eggs eaten at home are recorded as loss (`rusak`), not as sales, so they raise HPP rather than quietly disappearing from stock.

## 7. Success metrics

- Owner records ≥ 90% of orders in the app within 4 weeks of starting.
- New order entered in < 20 seconds on a phone.
- Owner can state last month's profit from the app without a spreadsheet.
- Zero eggs lost to missed supplier return windows.
- A second, different small business (e.g. snacks, laundry) can be set up from a blank or adapted template in < 30 minutes without help, proving the model is general.

## 8. Out of scope (for now)

Full double-entry accounting and tax reports, payroll, multi-warehouse, marketplace integrations (Shopee/Tokopedia), barcode scanning, customer-facing ordering portal, AI assistant (candidate for P2: "describe your business and get a board").

## 9. Open questions for the owners

Answered 2026-09-29: selling prices (Rp 3.300 mentah / Rp 3.500 matang, assumed the same for Warung and Catering), bonus +5 eggs per purchase, loss ~2 eggs per batch. See §6.

Still open:
1. **LPG cost per batch.** Easiest: how many batches does one tabung last, and what does a tabung cost? Plus the extra for an urgent batch.
2. Is the ~2-egg loss the same for a 10-egg batch and a 60-egg batch? What is the largest batch the pot holds?
3. Do catering customers pay the same Rp 3.500, or is there a volume price?
4. Does the +5 bonus also apply when buying boiled eggs from the supplier?
5. **Estimated 600 sales**: per week, per month, or around Maulid Nabi only?
6. Do warung pay on the spot, or on credit (tempo)?
7. Who delivers, and how is delivery cost decided (fixed fee, fuel, per trip)?
8. Tray size: 30 eggs?
9. Are returned eggs refunded in cash or as credit on the next purchase?

## 10. Release plan

| Phase | Scope |
|---|---|
| **M0 — Prototype** | Clickable mobile prototype of Today, New Order, Board (Kanban), Stock, Money screens with the Telur Asin template; test with Ibu & Ayah |
| **M1 — MVP (P0)** | Workspaces, lists, boards with Kanban + canvas editor, rules, action catalog, stock ledger with lots, production, delivery, money, HPP, P&L, Today report; web + Android |
| **M2** | P1 items: offline mode, receivables, roles, WhatsApp share, exports, stock opname, mobile board editing |
| **M3** | Template gallery, second vertical, iOS, AI "describe your business" onboarding |
