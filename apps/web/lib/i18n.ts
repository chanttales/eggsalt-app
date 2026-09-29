// UI strings. Bahasa Indonesia is the default locale; English is kept in step for later switching.
const messages = {
  id: {
    "nav.label": "Navigasi utama",
    "nav.today": "Hari ini",
    "nav.boards": "Papan",
    "nav.stock": "Stok",
    "nav.money": "Uang",
    "nav.more": "Lainnya",
    "page.placeholder": "Halaman ini sedang disiapkan.",
  },
  en: {
    "nav.label": "Main navigation",
    "nav.today": "Today",
    "nav.boards": "Boards",
    "nav.stock": "Stock",
    "nav.money": "Money",
    "nav.more": "More",
    "page.placeholder": "This page is being prepared.",
  },
} as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof (typeof messages)["id"];

export function t(key: MessageKey, locale: Locale = "id"): string {
  return messages[locale][key];
}
