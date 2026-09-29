-- Templates: ready-made setups a new workspace starts from. A template is global (no workspace)
-- and read-only for clients; setup copies its payload into the workspace's own tables, where the
-- owner can change everything. Board graphs follow boardGraph in packages/domain.
--
-- Telur Asin: salted duck eggs, stock states Mentah / Matang / Rusak, supplier returns on day 5,
-- and four boards (PRD section 6): Pesanan Warung, Pre-order Catering, Produksi (Rebus),
-- Pembelian & Retur. Prices and supplier terms are defaults the owner edits during setup.

create table template (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,               -- 'telur-asin'
  name        text not null,
  description text,
  payload     jsonb not null,                     -- settings, items, products, suppliers, categories, card types, boards
  is_public   boolean not null default true
);

alter table template enable row level security;
create policy template_read on template for select to authenticated using (is_public);
revoke insert, update, delete, truncate on template from public, anon, authenticated;

insert into template (key, name, description, payload) values (
  'telur-asin',
  'Telur Asin',
  'Jual telur asin mentah dan matang ke warung dan catering, dengan rebus sesuai pesanan dan retur ke pemasok di hari ke-5.',
  $json$
{
  "version": 1,
  "settings": {
    "lpg_per_batch": 1000,
    "expected_loss_per_batch": 2,
    "max_batch_size": 60,
    "unpaid_after_days": 7
  },
  "items": [
    {
      "key": "telur_asin_bebek",
      "name": "Telur asin bebek",
      "unit": "butir",
      "pack_name": "tray",
      "pack_size": 30,
      "states": [
        { "key": "mentah", "name": "Mentah", "sellable": true, "returnable": true, "color": "amber", "sort": 0 },
        { "key": "matang", "name": "Matang", "sellable": true, "returnable": false, "color": "teal", "sort": 1 },
        { "key": "rusak", "name": "Rusak", "sellable": false, "returnable": false, "color": "gray", "sort": 2 }
      ]
    }
  ],
  "products": [
    { "key": "telur_asin_mentah", "name": "Telur asin mentah", "item": "telur_asin_bebek", "state": "mentah", "sell_price": 3300, "buy_price": 2300 },
    { "key": "telur_asin_matang", "name": "Telur asin matang", "item": "telur_asin_bebek", "state": "matang", "sell_price": 3500, "buy_price": 2500 }
  ],
  "suppliers": [
    { "key": "pemasok_telur", "name": "Pemasok telur bebek", "return_days": 5, "bonus_per_purchase": 5, "min_purchase_qty": 100 }
  ],
  "customer_segments": ["Warung", "Catering"],
  "expense_categories": [
    { "key": "lpg", "name": "LPG", "sort": 0 },
    { "key": "delivery", "name": "Ongkir", "sort": 1 },
    { "key": "accommodation", "name": "Akomodasi", "sort": 2 },
    { "key": "other", "name": "Lainnya", "sort": 3 }
  ],
  "card_types": [
    {
      "key": "pesanan",
      "name": "Pesanan",
      "kind": "order",
      "icon": "shopping-bag",
      "fields": [
        { "key": "tanggal_kirim", "label": { "id": "Tanggal kirim", "en": "Delivery date" }, "type": "date", "sort": 0 },
        { "key": "tanggal_acara", "label": { "id": "Tanggal acara", "en": "Event date" }, "type": "date", "sort": 1 },
        { "key": "ongkir", "label": { "id": "Ongkir", "en": "Delivery cost" }, "type": "money", "sort": 2 },
        { "key": "jumlah_bayar", "label": { "id": "Jumlah dibayar", "en": "Amount paid" }, "type": "money", "sort": 3 },
        { "key": "metode_bayar", "label": { "id": "Cara bayar", "en": "Payment method" }, "type": "select", "sort": 4,
          "config": { "options": ["cash", "transfer", "qris"] } },
        { "key": "catatan", "label": { "id": "Catatan", "en": "Notes" }, "type": "text", "sort": 5 }
      ]
    },
    {
      "key": "rebus",
      "name": "Batch rebus",
      "kind": "production",
      "icon": "flame",
      "fields": [
        { "key": "jumlah_rebus", "label": { "id": "Jumlah direbus", "en": "Eggs boiled" }, "type": "number", "required": true, "sort": 0, "config": { "min": 1, "max": 60 } },
        { "key": "jumlah_bagus", "label": { "id": "Jumlah bagus", "en": "Good eggs" }, "type": "number", "sort": 1, "config": { "min": 0 } },
        { "key": "jumlah_rusak", "label": { "id": "Jumlah rusak", "en": "Damaged eggs" }, "type": "number", "sort": 2, "config": { "min": 0 } },
        { "key": "biaya_lpg", "label": { "id": "Biaya LPG", "en": "LPG cost" }, "type": "money", "sort": 3 },
        { "key": "mendesak", "label": { "id": "Mendesak", "en": "Urgent" }, "type": "boolean", "sort": 4 }
      ]
    },
    {
      "key": "pembelian",
      "name": "Pembelian",
      "kind": "purchase",
      "icon": "truck",
      "fields": [
        { "key": "jumlah_dibayar", "label": { "id": "Jumlah dibeli", "en": "Eggs paid for" }, "type": "number", "required": true, "sort": 0, "config": { "min": 1 } },
        { "key": "bonus", "label": { "id": "Bonus", "en": "Free eggs" }, "type": "number", "sort": 1, "config": { "min": 0 } },
        { "key": "harga_satuan", "label": { "id": "Harga per butir", "en": "Price per egg" }, "type": "money", "sort": 2 },
        { "key": "jumlah_retur", "label": { "id": "Jumlah diretur", "en": "Eggs returned" }, "type": "number", "sort": 3, "config": { "min": 0 } }
      ]
    }
  ],
  "boards": [
    {
      "key": "pesanan_warung",
      "name": "Pesanan Warung",
      "card_type": "pesanan",
      "sort": 0,
      "graph": {
        "entry": "baru",
        "terminal": ["selesai"],
        "stages": [
          { "key": "baru", "name": "Baru", "color": "gray" },
          { "key": "cek_stok", "name": "Cek stok", "color": "blue",
            "onEnter": [{ "action": "check_stock", "state": "matang" }] },
          { "key": "perlu_rebus", "name": "Perlu rebus", "color": "orange",
            "onEnter": [{ "action": "create_linked_card", "board": "produksi_rebus" }] },
          { "key": "dijadwal_ulang", "name": "Dijadwal ulang", "color": "pink", "require": ["tanggal_kirim"] },
          { "key": "disiapkan", "name": "Disiapkan", "color": "violet" },
          { "key": "dikirim", "name": "Dikirim", "color": "teal", "require": ["ongkir"],
            "onEnter": [
              { "action": "move_stock", "state": "matang", "qty": "{{lines.qty}}", "reason": "sale" },
              { "action": "record_money", "kind": "expense", "category": "delivery", "amount": "{{fields.ongkir}}", "allocate": "card" }
            ] },
          { "key": "diambil", "name": "Diambil", "color": "teal",
            "onEnter": [{ "action": "move_stock", "state": "matang", "qty": "{{lines.qty}}", "reason": "sale" }] },
          { "key": "dibayar", "name": "Dibayar", "color": "amber", "require": ["jumlah_bayar"],
            "onEnter": [{ "action": "record_money", "kind": "customer_payment", "amount": "{{fields.jumlah_bayar}}" }] },
          { "key": "selesai", "name": "Selesai", "color": "green" }
        ],
        "transitions": [
          { "from": "baru", "to": "cek_stok" },
          { "from": "cek_stok", "to": "disiapkan", "label": "Stok cukup",
            "when": { "fn": "stock_available", "state": "matang", "gte": "{{lines.qty}}" } },
          { "from": "cek_stok", "to": "perlu_rebus", "label": "Rebus dulu",
            "when": { "fn": "stock_available", "state": "matang", "lt": "{{lines.qty}}" } },
          { "from": "cek_stok", "to": "dijadwal_ulang", "label": "Jadwal ulang" },
          { "from": "perlu_rebus", "to": "disiapkan" },
          { "from": "dijadwal_ulang", "to": "cek_stok" },
          { "from": "disiapkan", "to": "dikirim", "label": "Kirim" },
          { "from": "disiapkan", "to": "diambil", "label": "Diambil pembeli" },
          { "from": "dikirim", "to": "dibayar" },
          { "from": "diambil", "to": "dibayar" },
          { "from": "dibayar", "to": "selesai" }
        ]
      }
    },
    {
      "key": "preorder_catering",
      "name": "Pre-order Catering",
      "card_type": "pesanan",
      "sort": 1,
      "suggest_when": { "any": [
        { "field": "party.segment", "op": "eq", "value": "Catering" },
        { "field": "lines.qty", "op": "gte", "value": 100 }
      ] },
      "graph": {
        "entry": "preorder_diterima",
        "terminal": ["selesai"],
        "stages": [
          { "key": "preorder_diterima", "name": "Pre-order diterima", "color": "gray", "require": ["tanggal_acara"] },
          { "key": "stok_dipesan", "name": "Stok dipesan", "color": "blue",
            "onEnter": [
              { "action": "reserve_stock", "state": "mentah", "qty": "{{lines.qty}}" },
              { "action": "remind", "message": "Rebus telur untuk acara besok", "offsetDays": -1, "from": "fields.tanggal_acara" }
            ] },
          { "key": "rebus", "name": "Rebus (H-1)", "color": "orange",
            "onEnter": [
              { "action": "release_reservation", "state": "mentah" },
              { "action": "create_linked_card", "board": "produksi_rebus" }
            ] },
          { "key": "siap", "name": "Siap", "color": "violet" },
          { "key": "dikirim", "name": "Dikirim", "color": "teal", "require": ["ongkir"],
            "onEnter": [
              { "action": "move_stock", "state": "matang", "qty": "{{lines.qty}}", "reason": "sale" },
              { "action": "record_money", "kind": "expense", "category": "delivery", "amount": "{{fields.ongkir}}", "allocate": "card" }
            ] },
          { "key": "dibayar", "name": "Dibayar", "color": "amber", "require": ["jumlah_bayar"],
            "onEnter": [{ "action": "record_money", "kind": "customer_payment", "amount": "{{fields.jumlah_bayar}}" }] },
          { "key": "selesai", "name": "Selesai", "color": "green" }
        ],
        "transitions": [
          { "from": "preorder_diterima", "to": "stok_dipesan" },
          { "from": "stok_dipesan", "to": "rebus" },
          { "from": "rebus", "to": "siap" },
          { "from": "siap", "to": "dikirim" },
          { "from": "dikirim", "to": "dibayar" },
          { "from": "dibayar", "to": "selesai" }
        ]
      }
    },
    {
      "key": "produksi_rebus",
      "name": "Produksi (Rebus)",
      "card_type": "rebus",
      "sort": 2,
      "graph": {
        "entry": "rencana",
        "terminal": ["siap"],
        "stages": [
          { "key": "rencana", "name": "Rencana", "color": "gray", "require": ["jumlah_rebus"] },
          { "key": "direbus", "name": "Direbus", "color": "orange" },
          { "key": "sortir", "name": "Sortir", "color": "blue", "require": ["jumlah_bagus", "jumlah_rusak", "biaya_lpg"],
            "onEnter": [
              { "action": "move_stock", "state": "mentah", "toState": "matang", "qty": "{{fields.jumlah_bagus}}", "reason": "production_out" },
              { "action": "move_stock", "state": "mentah", "toState": "rusak", "qty": "{{fields.jumlah_rusak}}", "reason": "damage" },
              { "action": "record_money", "kind": "expense", "category": "lpg", "amount": "{{fields.biaya_lpg}}", "allocate": "card" }
            ] },
          { "key": "siap", "name": "Siap", "color": "green" }
        ],
        "transitions": [
          { "from": "rencana", "to": "direbus", "label": "Mulai rebus" },
          { "from": "direbus", "to": "sortir" },
          { "from": "sortir", "to": "siap" }
        ]
      }
    },
    {
      "key": "pembelian_retur",
      "name": "Pembelian & Retur",
      "card_type": "pembelian",
      "sort": 3,
      "graph": {
        "entry": "dipesan",
        "terminal": ["habis", "dikembalikan"],
        "stages": [
          { "key": "dipesan", "name": "Dipesan", "color": "gray", "require": ["jumlah_dibayar"] },
          { "key": "diterima", "name": "Diterima", "color": "blue", "require": ["jumlah_dibayar", "harga_satuan"] },
          { "key": "habis", "name": "Habis terjual", "color": "green" },
          { "key": "dikembalikan", "name": "Dikembalikan", "color": "amber", "require": ["jumlah_retur"] }
        ],
        "transitions": [
          { "from": "dipesan", "to": "diterima" },
          { "from": "diterima", "to": "habis", "label": "Tidak ada sisa" },
          { "from": "diterima", "to": "dikembalikan", "label": "Retur sisa (hari ke-5)" }
        ]
      }
    }
  ]
}
  $json$::jsonb
);
