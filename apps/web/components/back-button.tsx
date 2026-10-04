"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { t } from "@/lib/i18n";

// Pages visited inside the app since it was loaded. A reload or a direct link starts it over,
// so there is nothing in the app to go back to and the back button hides.
let visited: string[] = [];
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const canGoBack = () => visited.length > 1;

/** Mounted once in the layout: records each page change, and drops a page when going back. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (visited.at(-1) === pathname) return;
    visited = visited.at(-2) === pathname ? visited.slice(0, -1) : [...visited, pathname];
    listeners.forEach((listener) => listener());
  }, [pathname]);
  return null;
}

/** Goes back to the previous page in the app; hidden when there is none. */
export function BackButton() {
  const router = useRouter();
  const show = useSyncExternalStore(subscribe, canGoBack, () => false);
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label={t("nav.back")}
      onClick={() => router.back()}
      className="-ml-2 grid size-10 shrink-0 place-items-center rounded-full text-foreground"
    >
      <ChevronLeft aria-hidden className="size-6" />
    </button>
  );
}
