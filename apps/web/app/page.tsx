"use client";

import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProgressRing } from "@/components/progress-ring";
import { Banner, EmptyState, primaryButton } from "@/components/ui";
import { batchQty, boardMap, dueDay, isTerminal } from "@/lib/board-model";
import { count, dayKey, shortDate, TIME_ZONE } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  cardQty,
  useBoards,
  useOpenCards,
  useReturnLots,
  useSettings,
  useStockLevels,
  type Board,
  type Card,
} from "@/lib/queries";
import { useSession } from "@/lib/session";

const DAYS_SHOWN = 5;

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 11) return t("home.morning");
  if (hour < 15) return t("home.noon");
  if (hour < 18) return t("home.afternoon");
  return t("home.evening");
}

/** Today and the next few days, as YYYY-MM-DD in Jakarta. */
function nextDays(): string[] {
  const start = Date.parse(`${dayKey()}T00:00:00Z`);
  return Array.from({ length: DAYS_SHOWN }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
}

function weekday(day: string): string {
  return new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

function Header() {
  const { state } = useSession();
  const user = state.status === "signed_in" ? state.session.user : undefined;
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const name = meta.full_name ?? meta.name ?? user?.email?.split("@")[0] ?? "";
  const avatar = meta.avatar_url ?? meta.picture;

  return (
    <header className="rounded-b-[20px] bg-primary px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-7 text-primary-foreground">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-label opacity-90">{greeting()}</p>
          <h1 className="truncate text-title-lg font-semibold">{name}</h1>
        </div>
        <Link href="/profil" aria-label={t("nav.profile")} className="shrink-0">
          {avatar ? (
            // Google's avatar URL; referrer hidden so it loads outside Google's own sites.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="size-11 rounded-full border-2 border-white/70 object-cover"
            />
          ) : (
            <span className="flex size-11 items-center justify-center rounded-full bg-white/20 text-title font-semibold">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

function Shortcut({ href, title, status }: { href: string; title: string; status: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[100px] flex-col justify-between rounded-[14px] bg-primary-soft p-3.5 shadow-[0_1px_1px_1px_rgb(0_0_0/0.05)]"
    >
      <span className="text-label font-semibold">{title}</span>
      <span className="flex items-center justify-between text-label font-medium text-primary">
        {status}
        <ArrowRight aria-hidden size={18} />
      </span>
    </Link>
  );
}

function OrderCard({ card, board }: { card: Card; board: Board | undefined }) {
  const stages = board?.graph.stages ?? [];
  const index = stages.findIndex((s) => s.key === card.stageKey);
  const progress = stages.length > 1 ? (Math.max(0, index) / (stages.length - 1)) * 100 : 0;
  const stageName = stages[index]?.name ?? card.stageKey;

  return (
    <Link
      href={`/kartu?id=${card.id}`}
      className="relative flex items-center gap-3 overflow-hidden rounded-[14px] bg-linear-[111deg] from-[#eaefff] to-[#faf9ff] py-4 pr-4 pl-6"
    >
      <span aria-hidden className="absolute top-5 left-0 h-7 w-1 rounded-r-[10px] bg-primary" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="truncate text-label font-semibold">
            {card.title} #{card.number}
          </p>
          <p className="truncate text-label text-muted-foreground">
            {[card.partyName, board?.name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-6 text-label">
          <div>
            <p className="text-muted-foreground">{t("home.qty")}</p>
            <p className="font-medium">
              {count(cardQty(card))} {t("unit.egg")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("home.stage")}</p>
            <p className="font-medium">{stageName}</p>
          </div>
          {card.dueAt && (
            <div>
              <p className="text-muted-foreground">{t("home.due")}</p>
              <p className="flex items-center gap-1 font-medium">
                <CalendarDays aria-hidden size={15} />
                {shortDate(card.dueAt)}
              </p>
            </div>
          )}
        </div>
      </div>
      <ProgressRing value={progress} />
    </Link>
  );
}

// Home: greeting with the Google name and photo, a strip of the next days, shortcuts to the four
// things the business checks most, reminders, and the orders due on the chosen day.
export default function HomePage() {
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";
  const boards = useBoards();
  const cards = useOpenCards();
  const lots = useReturnLots();
  const stock = useStockLevels();
  const settings = useSettings();
  const days = nextDays();
  const today = days[0]!;
  const [day, setDay] = useState(today);

  const byBoard = boardMap(boards.data);
  const all = cards.data ?? [];
  const cardsById = new Map(all.map((c) => [c.id, c]));
  const orderBoards = (boards.data ?? []).filter((b) => b.kind === "order");
  const warung = orderBoards.find((b) => b.key === "pesanan_warung") ?? orderBoards[0];
  const catering = orderBoards.find((b) => b.key === "preorder_catering") ?? orderBoards[1];
  const openOn = (board: Board | undefined) =>
    board ? all.filter((c) => c.boardId === board.id && !isTerminal(board, c.stageKey)).length : 0;

  const orders = all.filter(
    (c) =>
      byBoard.get(c.boardId)?.kind === "order" && !isTerminal(byBoard.get(c.boardId), c.stageKey),
  );
  // Today also shows anything overdue, so nothing late drops off the screen.
  const onDay = orders
    .filter((c) => {
      const due = dueDay(c);
      return due !== null && (day === today ? due <= today : due === day);
    })
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  const waitingBatches = all.filter((c) => {
    const board = byBoard.get(c.boardId);
    return board?.kind === "production" && c.stageKey === board.graph.entry;
  });
  const toBoil = waitingBatches.reduce((sum, c) => sum + batchQty(c, cardsById), 0);
  const loss = settings.data?.expectedLossPerBatch ?? 0;
  const sellable = (stock.data ?? [])
    .filter((s) => s.sellable)
    .reduce((sum, s) => sum + s.available, 0);

  const returnToday = (lots.data ?? []).filter((l) => l.daysLeft <= 0);
  const returnTomorrow = (lots.data ?? []).filter((l) => l.daysLeft === 1);
  const loading = boards.isPending || cards.isPending;

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pt-6 pb-4">
        <section className="flex flex-col gap-3">
          <h2 className="text-title font-medium">{t("home.pickDate")}</h2>
          <div className="grid grid-cols-5 items-center gap-2">
            {days.map((d) => {
              const active = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDay(d)}
                  className={`flex flex-col items-center justify-center rounded-[15px] ${
                    active
                      ? "h-[87px] bg-primary text-primary-foreground"
                      : "h-[73px] bg-surface-muted text-muted-foreground"
                  }`}
                >
                  <span className="text-body capitalize">{weekday(d)}</span>
                  <span className={`text-title-lg font-medium ${active ? "" : "text-foreground"}`}>
                    {Number(d.slice(8))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-title font-medium">{t("home.shortcuts")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Shortcut
              href={warung ? `/papan?b=${warung.id}` : "/papan"}
              title={t("home.warung")}
              status={t("home.running").replace("{n}", count(openOn(warung)))}
            />
            <Shortcut
              href={catering ? `/papan?b=${catering.id}` : "/papan"}
              title={t("home.catering")}
              status={t("home.running").replace("{n}", count(openOn(catering)))}
            />
            <Shortcut
              href="/stok?aksi=rebus"
              title={t("home.boil")}
              status={`${count(toBoil > 0 ? toBoil + loss : 0)} ${t("unit.egg")}`}
            />
            <Shortcut
              href="/stok"
              title={t("nav.stock")}
              status={t("home.sellable").replace("{n}", count(sellable))}
            />
          </div>
        </section>

        {returnToday.map((lot) => (
          <Banner
            key={lot.id}
            tone="warning"
            title={`${t("today.returnToday")}: ${count(lot.qtyRemaining)} ${t("unit.egg")}`}
            action={
              isOwner && (
                <Link href={`/stok?aksi=retur&lot=${lot.id}`} className={primaryButton}>
                  {t("today.returnNow")}
                </Link>
              )
            }
          >
            {t("today.returnBody").replace("{date}", shortDate(lot.receivedAt))}
          </Banner>
        ))}
        {returnTomorrow.map((lot) => (
          <Banner
            key={lot.id}
            tone="warning"
            title={`${t("today.returnTomorrow")}: ${count(lot.qtyRemaining)} ${t("unit.egg")}`}
          >
            {t("today.returnBody").replace("{date}", shortDate(lot.receivedAt))}
          </Banner>
        ))}
        {toBoil > 0 && (
          <Banner
            tone="suggest"
            title={t("today.boilTitle").replace("{n}", count(toBoil + loss))}
            action={
              <Link href="/stok?aksi=rebus" className={primaryButton}>
                {t("today.boilStart")}
              </Link>
            }
          >
            {t("today.boilBody")
              .replace("{orders}", count(waitingBatches.length))
              .replace("{loss}", count(loss))}
          </Banner>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-title font-medium">
            {day === today
              ? t("home.ordersToday")
              : `${t("home.ordersOn")} ${shortDate(`${day}T12:00:00+07:00`)}`}
          </h2>
          {loading ? (
            <EmptyState>{t("auth.loading")}</EmptyState>
          ) : onDay.length ? (
            onDay.map((c) => <OrderCard key={c.id} card={c} board={byBoard.get(c.boardId)} />)
          ) : (
            <EmptyState>{t("home.noOrders")}</EmptyState>
          )}
        </section>
      </main>
    </>
  );
}
