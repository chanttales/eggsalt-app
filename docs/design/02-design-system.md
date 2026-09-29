# Business Whiteboard: Design System

**Status:** Draft v0.1 · 2026-09-29 · Step 2 of the roadmap (after `01-prd.md`)
**Implementation target:** Tailwind CSS + shadcn/ui (Radix) in Next.js, same components in the Capacitor app

---

## 1. Principles

| Principle | What it means on screen |
|---|---|
| **Thumb first** | Daily actions reachable one-handed; primary actions at the bottom; targets ≥ 48 px |
| **Numbers are the hero** | Qty, stock and rupiah are big, tabular and never truncated |
| **Calm, not corporate** | Warm neutrals, one strong brand color, color reserved for meaning (status, stage) |
| **Forgiving** | Every action can be undone from a toast; destructive actions confirm in a sheet |
| **Plain Bahasa** | "Pesanan", "Stok", "Uang", not "Sales Order", "Inventory Ledger" |
| **Same everywhere** | One component set for web and mobile; layout adapts, components don't fork |

## 2. Design tokens

Tokens are CSS variables (`:root` + `.dark`), mapped into `tailwind.config.ts`. Names follow shadcn/ui so its components work unchanged.

### 2.1 Color

Brand idea: **duck-egg shell** (blue-green) as primary, **salted yolk** (orange) as accent.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#FAFAF7` | `#0F1412` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | `#161C1A` | Cards, sheets |
| `--surface-muted` | `#F2F1EC` | `#1E2523` | Kanban column, input fill |
| `--border` | `#E4E2DA` | `#2A3330` | Dividers, outlines |
| `--foreground` | `#1C2421` | `#EEF2F0` | Body text |
| `--muted-foreground` | `#5E6B66` | `#9AA8A2` | Secondary text |
| `--primary` | `#0F766E` | `#2DB3A5` | Primary buttons, active tab, links |
| `--primary-foreground` | `#FFFFFF` | `#06201D` | Text on primary |
| `--primary-soft` | `#E0F2EF` | `#123330` | Selected chips, highlights |
| `--accent` | `#F59E0B` | `#FBBF24` | Yolk accent: FAB ring, "today" marker, illustrations (fills only, never text on white) |
| `--accent-foreground` | `#3A2500` | `#2A1B00` | Text on accent |
| `--success` | `#15803D` | `#4ADE80` | Paid, delivered, profit ≥ 0 |
| `--warning` | `#B45309` | `#FBBF24` | Due soon, low stock, return window closing |
| `--danger` | `#B91C1C` | `#F87171` | Overdue, negative profit, destructive |
| `--info` | `#1D4ED8` | `#60A5FA` | In progress, scheduled |

All text/background pairs above meet WCAG AA (4.5:1) for body text; `--accent` is decorative only.

**Stage colors** (the owner picks one per stage on a board; each has a soft bg + strong text pair):

`gray` · `teal` · `blue` · `violet` · `pink` · `orange` · `amber` · `green`

| Name | Soft bg (light) | Text (light) |
|---|---|---|
| gray | `#EEEDE8` | `#44504B` |
| teal | `#DDF3EF` | `#0F5F58` |
| blue | `#E0EAFD` | `#1E40AF` |
| violet | `#EDE7FD` | `#5B21B6` |
| pink | `#FBE4EF` | `#9D174D` |
| orange | `#FDEBDD` | `#9A3412` |
| amber | `#FDF3D6` | `#854D0E` |
| green | `#E1F5E6` | `#166534` |

Stock-state convention (default, editable): **Mentah = amber**, **Matang = orange**, **Rusak = gray**, **Reserved = violet**.

### 2.2 Typography

Font: **Plus Jakarta Sans** (designed in Indonesia, free, good numerals) via `next/font` with `font-feature-settings: "tnum"` on numbers. Fallback: `system-ui`.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `display` | 32 / 40 | 700 | Big numbers on stat tiles (Rp 1.250.000) |
| `title-lg` | 22 / 28 | 700 | Screen titles |
| `title` | 18 / 24 | 600 | Section headers, sheet titles |
| `body` | 16 / 24 | 400 | Default text (never below 16 on inputs, avoids iOS zoom) |
| `body-strong` | 16 / 24 | 600 | Card titles, customer names |
| `label` | 14 / 20 | 500 | Field labels, chips, buttons |
| `caption` | 12 / 16 | 500 | Meta: time, stage, "2 jam lalu" |

Numbers: always tabular figures; rupiah as `Rp 3.500` (id-ID, no decimals); quantities with unit: `20 butir`, `1 tray + 5`.

### 2.3 Spacing, radius, elevation, motion

| Token | Values |
|---|---|
| Spacing (4 px base) | `1`=4 · `2`=8 · `3`=12 · `4`=16 · `5`=20 · `6`=24 · `8`=32 · `12`=48 |
| Page gutter | 16 px mobile · 24 px tablet · 32 px desktop |
| Radius | `sm` 8 (chips, inputs) · `md` 12 (cards, buttons) · `lg` 16 (sheets, tiles) · `full` (pills, FAB) |
| Elevation | `0` flat · `1` card `0 1px 2px rgb(0 0 0 / .06)` · `2` sheet/FAB `0 8px 24px rgb(0 0 0 / .12)` |
| Motion | 150 ms micro (press, toggle) · 250 ms sheets/cards · easing `cubic-bezier(.2,.8,.2,1)`; respect `prefers-reduced-motion` |
| Touch target | min 48 × 48 px; 8 px between adjacent targets |

### 2.4 Breakpoints and layout

| Name | Width | Layout |
|---|---|---|
| `mobile` | < 640 | Bottom tab bar, single column, sheets from bottom |
| `tablet` | 640–1023 | Bottom bar or rail; Kanban shows 2–3 columns |
| `desktop` | ≥ 1024 | Left sidebar nav, Kanban full width, canvas editor, side panel for card detail |

Safe areas: pad with `env(safe-area-inset-*)` for notches and the Android gesture bar (Capacitor).

### 2.5 Iconography

**Lucide** icons (ships with shadcn/ui), 20 px in lists, 24 px in nav, 1.75 stroke. Key mappings: Hari ini `sun`, Papan `kanban-square`, Stok `package`, Uang `wallet`, Lainnya `menu`, Rebus `flame`, Kirim `truck`, Bayar `banknote`, Retur `undo-2`, Pesanan `clipboard-list`.

## 3. Components

Built on shadcn/ui where it exists; ★ = new, app-specific.

### 3.1 Basics

| Component | Variants / notes |
|---|---|
| **Button** | `primary` · `secondary` (soft) · `ghost` · `danger`; sizes `md` 44 px, `lg` 52 px (bottom actions); full-width on mobile forms; loading state keeps width |
| **Input / Textarea** | 48 px tall, label above, helper/error below; `inputmode="numeric"` for numbers |
| **Select / Combobox** | Opens as bottom sheet on mobile, popover on desktop; search when > 7 options |
| **Chip** | Filter chip (toggle), quick-value chip (tap to fill) |
| **Badge / StatusPill** | Uses stage colors or semantic colors; dot + text, never color alone |
| **Tabs / SegmentedControl** | Mentah / Matang switch, period switch (Hari · Minggu · Bulan) |
| **Sheet** | Bottom sheet on mobile (drag handle, snap 50%/90%), side panel on desktop |
| **Dialog** | Only for destructive confirmation |
| **Toast** | Bottom, above tab bar; always offers **Batalkan** (undo) for 5 s after a card move or money entry |
| **Skeleton / EmptyState** | Empty states explain the next action: "Belum ada pesanan hari ini. + Pesanan baru" |

### 3.2 App-specific ★

| Component | Purpose / anatomy |
|---|---|
| ★ **QtyStepper** | Big number, − / + buttons, quick chips from typical quantities (10 · 15 · 20 · 25 · 40 · 100), toggle butir/tray |
| ★ **MoneyInput** | "Rp" prefix, live thousand separators, numeric keypad, shortcut chips (Lunas / Separuh) |
| ★ **BoardCard** | Title (customer), qty + variant, due chip, amount, stage-color left edge, warning icon (shortage/overdue); swipe right = next stage, long-press = menu |
| ★ **StageColumn** | Header (name, count, color), scrollable cards, "+ " at bottom; horizontally snapping on mobile |
| ★ **StageStepper** | Horizontal progress of a card through stages on its detail screen; tappable for skip (with reason) |
| ★ **TransitionPicker** | Sheet listing possible next stages when a rule branches, each with the reason ("Stok kurang → Jadwal ulang") |
| ★ **StatTile** | Label, `display` number, delta vs. previous period, optional sparkline |
| ★ **StockMeter** | Per state: count, tray equivalent, reserved portion striped, low-stock marker |
| ★ **LotRow** | Lot date, remaining qty, cost, return countdown badge ("Retur 2 hari lagi") |
| ★ **ProfitBreakdown** | Revenue − HPP − delivery − other = profit, as a stacked list with the final line emphasized |
| ★ **SuggestionBanner** | Smart hints: "Gabungkan 3 pesanan → rebus 55 telur sekali (hemat Rp 3.100)" with an action button |
| ★ **QuickAddFAB** | Round yolk-ringed FAB → sheet with Pesanan · Pengeluaran · Terima stok · Rebus |
| ★ **BottomTabBar** | 5 tabs: Hari ini · Papan · Stok · Uang · Lainnya; badge counts for due items |
| ★ **OfflineBanner** | Slim bar: "Offline · 3 perubahan menunggu dikirim"; turns green on sync |
| ★ **Canvas nodes** (React Flow) | StageNode (color, name, action icons), RuleEdge (label chip with condition summary), StartNode, EndNode; desktop-first |
| ★ **RuleBuilder** | Sentence-style rows: [Jumlah] [≥] [100] · AND/ATAU · add row; never shows JSON |
| ★ **ActionPicker** | List of the 8 step actions with icon + one-line description, then a small form per action |

## 4. Patterns

- **Create flow**: bottom sheet with at most 3 required fields, rest under "Detail lainnya". Primary button fixed at the bottom of the sheet.
- **Move a card**: swipe or tap "Lanjut →"; if a rule blocks, show why inline (not an error page) plus the allowed alternative.
- **Money and stock changes**: always show the effect before confirming: "Stok matang 35 → 15 · Uang masuk Rp 70.000".
- **Undo over confirm**: routine actions go through with an undo toast; only deletes and returns to supplier ask first.
- **Dates**: relative for near dates ("Besok, 08.00", "H-1"), absolute beyond a week ("Sen, 6 Okt").
- **Loading**: skeletons for lists, optimistic updates for card moves and entries.
- **Errors**: say what happened and what to do, in Bahasa: "Gagal menyimpan. Akan dicoba lagi saat online."
- **Accessibility**: focus rings visible (`--primary` 2 px), all icons labelled, color never the only signal, supports system font scaling up to 130%.

## 5. Voice and microcopy

Friendly, short, informal-polite Bahasa Indonesia (no "Anda" overuse; address the owner implicitly). English available as a second locale.

| Instead of | Write |
|---|---|
| Sales Order created successfully | Pesanan tersimpan |
| Insufficient inventory | Stok matang kurang 12 butir |
| Transaction reversal | Dibatalkan |
| COGS | HPP |
| Delete record? This action cannot be undone. | Hapus pesanan ini? Tidak bisa dibatalkan. |

## 6. Implementation starter

```css
/* app/globals.css (excerpt) */
:root {
  --background: 60 20% 97%;      /* #FAFAF7 */
  --foreground: 158 13% 13%;     /* #1C2421 */
  --primary: 175 77% 26%;        /* #0F766E */
  --primary-foreground: 0 0% 100%;
  --accent: 38 92% 50%;          /* #F59E0B */
  --radius: 0.75rem;
}
.dark {
  --background: 156 14% 7%;
  --foreground: 150 14% 94%;
  --primary: 173 60% 44%;
  --primary-foreground: 174 69% 7%;
}
```

```ts
// tailwind.config.ts (excerpt)
theme: {
  extend: {
    fontFamily: { sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'] },
    colors: {
      primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
      accent:  { DEFAULT: 'hsl(var(--accent))' },
      // …remaining tokens from §2.1, plus stage.{gray,teal,…}.{bg,fg}
    },
    minHeight: { touch: '48px' },
  },
}
```

Folder: `packages/ui/` exports tokens + components; Storybook (optional) documents them. A visual preview page of these tokens can be produced in step 5 alongside the wireframes.

## 7. Open design questions

1. App name and logo? The docs use "Papan" / "Business Whiteboard" as placeholders.
2. Is the duck-egg teal + yolk palette right, or should the brand be neutral (for non-egg businesses)? Proposal: neutral brand, and each workspace can pick its accent color.
3. Bahasa Indonesia only for the pilot, or bilingual from day one?
