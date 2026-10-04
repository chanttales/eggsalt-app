"use client";

import {
  ChartColumn,
  ClipboardList,
  Contact,
  Egg,
  House,
  LayoutDashboard,
  Plus,
  Tag,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type MessageKey } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type Tab = { href: string; label: MessageKey; icon: LucideIcon; owner?: true };

const left: Tab[] = [
  { href: "/", label: "nav.home", icon: House },
  { href: "/papan", label: "nav.orders", icon: ClipboardList },
];
const right: Tab[] = [
  { href: "/uang", label: "nav.money", icon: Wallet },
  { href: "/profil", label: "nav.profile", icon: UserRound },
];
/** Desktop only: the pages a phone reaches from Home or Profil, one click away in the sidebar. */
const desktopGroups: { title: MessageKey; tabs: Tab[] }[] = [
  {
    title: "menu.summary",
    tabs: [
      { href: "/stok", label: "nav.stock", icon: Egg },
      { href: "/laporan", label: "report.title", icon: ChartColumn },
      { href: "/dasbor", label: "dash.title", icon: LayoutDashboard, owner: true },
    ],
  },
  {
    title: "menu.settings",
    tabs: [
      { href: "/atur/harga", label: "price.title", icon: Tag, owner: true },
      { href: "/atur/kontak", label: "contact.title", icon: Contact, owner: true },
    ],
  },
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

// Bottom bar on phone and tablet (Home, Pesanan, +, Uang, Profil). On desktop a left sidebar
// that also lists Stok, Laporan and the owner settings.
export function AppNav() {
  const pathname = usePathname();
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";

  return (
    <nav
      aria-label={t("nav.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:inset-y-0 lg:right-auto lg:w-56 lg:overflow-y-auto lg:border-t-0 lg:border-r lg:pb-6"
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
      {desktopGroups.map((group) => {
        const tabs = group.tabs.filter((tab) => isOwner || !tab.owner);
        if (!tabs.length) return null;
        return (
          <div key={group.title} className="hidden px-3 pt-6 lg:block">
            <p className="px-3 pb-2 text-caption font-semibold text-muted-foreground uppercase">
              {t(group.title)}
            </p>
            <ul className="flex flex-col gap-1">
              {tabs.map((tab) => (
                <TabLink key={tab.href} tab={tab} pathname={pathname} />
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
