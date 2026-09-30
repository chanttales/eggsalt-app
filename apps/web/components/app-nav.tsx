"use client";

import { Menu, Package, SquareKanban, Sun, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type MessageKey } from "@/lib/i18n";

const tabs: { href: string; label: MessageKey; icon: LucideIcon }[] = [
  { href: "/", label: "nav.today", icon: Sun },
  { href: "/papan", label: "nav.boards", icon: SquareKanban },
  { href: "/stok", label: "nav.stock", icon: Package },
  { href: "/uang", label: "nav.money", icon: Wallet },
  { href: "/lainnya", label: "nav.more", icon: Menu },
];

function isActive(pathname: string, href: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

// Bottom tab bar on phone and tablet, left sidebar on desktop (>= 1024px).
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("nav.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:inset-y-0 lg:right-auto lg:w-56 lg:border-t-0 lg:border-r lg:pb-0"
    >
      <p className="hidden px-6 pt-6 pb-4 text-title font-bold text-primary lg:block">EggSalt</p>
      <ul className="flex lg:flex-col lg:gap-1 lg:px-3">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1 lg:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-touch flex-col items-center justify-center gap-0.5 text-caption font-medium lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:text-body ${
                  active
                    ? "text-primary lg:bg-primary-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon aria-hidden size={24} strokeWidth={1.75} />
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
