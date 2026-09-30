"use client";

import { CircleHelp } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Sheet } from "@/components/sheet";
import { primaryButton } from "@/components/ui";
import { t, tOr } from "@/lib/i18n";

export const GUIDE_PAGES = ["today", "papan", "kartu", "stok", "uang", "laporan", "atur"] as const;
export type GuidePage = (typeof GUIDE_PAGES)[number];

function guideItems(page: GuidePage): string[] {
  const items: string[] = [];
  for (let i = 1; ; i++) {
    const text = tOr(`guide.${page}.${i}`, "");
    if (!text) return items;
    items.push(text);
  }
}

export function GuideList({ page }: { page: GuidePage }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-body">
      {guideItems(page).map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  );
}

const seenKey = (page: GuidePage) => `papan.guide.${page}`;
const noSubscribe = () => () => {};

function wasSeen(page: GuidePage): boolean {
  try {
    return localStorage.getItem(seenKey(page)) !== null;
  } catch {
    return true; // Storage blocked: the guide stays closed until tapped.
  }
}

// Help button in the page header. Opens by itself on the first visit so early users see what the page does.
export function GuideButton({ page }: { page: GuidePage }) {
  const seen = useSyncExternalStore(
    noSubscribe,
    () => wasSeen(page),
    () => true,
  );
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? !seen;

  const close = () => {
    setChosen(false);
    try {
      localStorage.setItem(seenKey(page), "1");
    } catch {
      // Storage blocked: nothing to remember.
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={t("guide.open")}
        onClick={() => setChosen(true)}
        className="flex min-h-touch min-w-touch items-center justify-center rounded-md text-muted-foreground"
      >
        <CircleHelp aria-hidden size={22} />
      </button>
      {open && (
        <Sheet title={tOr(`guide.${page}.title`, t("guide.all"))} onClose={close}>
          <GuideList page={page} />
          <button type="button" onClick={close} className={primaryButton}>
            {t("guide.done")}
          </button>
        </Sheet>
      )}
    </>
  );
}
