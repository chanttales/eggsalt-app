"use client";

import {
  BookOpen,
  ChartColumn,
  ChevronRight,
  Contact,
  LayoutDashboard,
  SquareKanban,
  Tag,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { Page, Section } from "@/components/ui";
import { t, type MessageKey } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type Entry = { href: string; label: MessageKey; hint: MessageKey; icon: LucideIcon; owner?: true };

const groups: { title: MessageKey; entries: Entry[] }[] = [
  {
    title: "menu.team",
    entries: [
      {
        href: "/atur/undangan",
        label: "invite.title",
        hint: "menu.inviteHint",
        icon: UserPlus,
        owner: true,
      },
    ],
  },
  {
    title: "menu.summary",
    entries: [
      {
        href: "/dasbor",
        label: "dash.title",
        hint: "menu.dashHint",
        icon: LayoutDashboard,
        owner: true,
      },
      { href: "/laporan", label: "report.title", hint: "menu.reportHint", icon: ChartColumn },
    ],
  },
  {
    title: "menu.settings",
    entries: [
      { href: "/atur/harga", label: "price.title", hint: "menu.priceHint", icon: Tag, owner: true },
      {
        href: "/atur/kontak",
        label: "contact.title",
        hint: "menu.contactHint",
        icon: Contact,
        owner: true,
      },
      {
        href: "/atur/papan",
        label: "editor.boards",
        hint: "menu.boardHint",
        icon: SquareKanban,
        owner: true,
      },
    ],
  },
  {
    title: "menu.help",
    entries: [{ href: "/panduan", label: "guide.all", hint: "guide.intro", icon: BookOpen }],
  },
];

function Account() {
  const { state } = useSession();
  if (state.status !== "signed_in") return null;
  const user = state.session.user;
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const name = meta.full_name ?? meta.name ?? user.email ?? "";
  const avatar = meta.avatar_url ?? meta.picture;

  return (
    <div className="flex items-center gap-4 rounded-[14px] bg-primary p-4 text-primary-foreground">
      {avatar ? (
        // Google's avatar URL; referrer hidden so it loads outside Google's own sites.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          referrerPolicy="no-referrer"
          className="size-16 rounded-full border-2 border-white/70 object-cover"
        />
      ) : (
        <span className="flex size-16 items-center justify-center rounded-full bg-white/20 text-title-lg font-semibold">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-title font-semibold">{name}</p>
        {user.email && <p className="truncate text-label opacity-90">{user.email}</p>}
        {state.workspace && (
          <p className="truncate text-label opacity-90">{state.workspace.name}</p>
        )}
      </div>
    </div>
  );
}

// Profil: the signed-in account, then invites, reports, business settings and help, grouped.
export default function ProfilePage() {
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";

  return (
    <Page title={t("nav.profile")}>
      <Account />
      {groups.map((g) => {
        const entries = g.entries.filter((e) => isOwner || !e.owner);
        if (entries.length === 0) return null;
        return (
          <Section key={g.title} title={t(g.title)}>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
              {entries.map(({ href, label, hint, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex min-h-touch items-center gap-3 p-3">
                    <Icon aria-hidden size={22} className="shrink-0 text-primary" />
                    <span className="flex flex-1 flex-col">
                      <span className="font-semibold">{t(label)}</span>
                      <span className="text-label text-muted-foreground">{t(hint)}</span>
                    </span>
                    <ChevronRight aria-hidden size={18} className="text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
      <SignOutButton />
    </Page>
  );
}
