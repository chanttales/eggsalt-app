"use client";

import { ClipboardList, House, Plus, UserRound, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type MessageKey } from "@/lib/i18n";

type Tab = { href: string; label: MessageKey; icon: LucideIcon };

const left: Tab[] = [
  { href: "/", label: "nav.home", icon: House },
  { href: "/papan", label: "nav.orders", icon: ClipboardList },
];
const right: Tab[] = [
  { href: "/uang", label: "nav.money", icon: Wallet },
  { href: "/profil", label: "nav.profile", icon: UserRound },
];
/** The centre button: record a new order. */
const ADD_HREF = "/papan?aksi=baru";

function isActive(pathname: string, href: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

function TabLink({ tab, pathname }: { tab: Tab; pathname: string }) {
  const active = isActive(pathname, tab.href);
  const Icon = tab.icon;
  return (
    <li className="flex-1 lg:flex-none">
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-touch flex-col items-center justify-center gap-0.5 text-caption font-medium lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:text-body ${
          active ? "text-primary lg:bg-primary-soft" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon aria-hidden size={24} strokeWidth={active ? 2.25 : 1.75} />
        {t(tab.label)}
      </Link>
    </li>
  );
}

// Bottom bar on phone and tablet (Home, Pesanan, +, Uang, Profil), left sidebar on desktop.
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("nav.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:inset-y-0 lg:right-auto lg:w-56 lg:border-t-0 lg:border-r lg:pb-0"
    >
      <p className="hidden px-6 pt-6 pb-4 text-title font-bold text-primary lg:block">EggSalt</p>
      <ul className="flex items-center py-2 lg:flex-col lg:items-stretch lg:gap-1 lg:px-3 lg:py-0">
        {left.map((tab) => (
          <TabLink key={tab.href} tab={tab} pathname={pathname} />
        ))}
        <li className="flex flex-1 justify-center lg:order-first lg:mb-2 lg:flex-none">
          <Link
            href={ADD_HREF}
            aria-label={t("order.new")}
            className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md lg:h-auto lg:min-h-touch lg:w-full lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:font-semibold"
          >
            <Plus aria-hidden size={26} strokeWidth={2.5} />
            <span className="hidden lg:inline">{t("order.new")}</span>
          </Link>
        </li>
        {right.map((tab) => (
          <TabLink key={tab.href} tab={tab} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}
