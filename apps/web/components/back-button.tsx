"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";

/** Goes back in the app's history, or to `fallback` when the page was opened directly. */
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={t("nav.back")}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full text-foreground"
    >
      <ChevronLeft aria-hidden className="size-6" />
    </button>
  );
}
