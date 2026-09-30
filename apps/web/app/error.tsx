"use client";

import { del } from "idb-keyval";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { ghostButton, primaryButton, secondaryButton } from "@/components/ui";
import { QUERY_CACHE_KEY } from "@/lib/data";
import { t } from "@/lib/i18n";

// Shown instead of a blank "This page couldn't load". Saved data on the device can be older than
// the app, so the last resort clears that copy (never the queue of unsent changes) and reloads.
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => console.error(error), [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
      <TriangleAlert aria-hidden size={40} className="text-warning" />
      <h1 className="text-title font-bold">{t("error.title")}</h1>
      <p className="text-muted-foreground">{t("error.body")}</p>
      <button type="button" onClick={reset} className={primaryButton}>
        {t("error.retry")}
      </button>
      <button
        type="button"
        onClick={async () => {
          await del(QUERY_CACHE_KEY).catch(() => undefined);
          window.location.reload();
        }}
        className={secondaryButton}
      >
        {t("error.refresh")}
      </button>
      <Link href="/" className={`${ghostButton} inline-flex items-center`}>
        {t("error.home")}
      </Link>
    </main>
  );
}
