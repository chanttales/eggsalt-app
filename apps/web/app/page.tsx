"use client";

import Link from "next/link";
import { CardRow } from "@/components/card-row";
import { Banner, EmptyState, Page, Section, StatTile, primaryButton } from "@/components/ui";
import { batchQty, boardMap, dueDay, isReadyStage, isTerminal } from "@/lib/board-model";
import { count, dayKey, longDate, rupiah, shortDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  cardQty,
  useBoards,
  useOpenCards,
  useOrderMoney,
  useReturnLots,
  useSettings,
} from "@/lib/queries";
import { useSession } from "@/lib/session";

// S03 Hari ini: what to do now. Tiles count live from the boards; the day-5 return task and the
// combined boil suggestion sit on top, then today's orders and upcoming pre-orders.
export default function TodayPage() {
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";
  const boards = useBoards();
  const cards = useOpenCards();
  const money = useOrderMoney();
  const lots = useReturnLots();
  const settings = useSettings();

  const today = dayKey();
  const byBoard = boardMap(boards.data);
  const all = cards.data ?? [];
  const cardsById = new Map(all.map((c) => [c.id, c]));
  const kindOf = (boardId: string) => byBoard.get(boardId)?.kind;

  const orders = all.filter(
    (c) => kindOf(c.boardId) === "order" && !isTerminal(byBoard.get(c.boardId), c.stageKey),
  );
  const dueNow = orders
    .filter((c) => {
      const day = dueDay(c);
      return day !== null && day <= today;
    })
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const upcoming = orders
    .filter((c) => {
      const day = dueDay(c);
      return day !== null && day > today;
    })
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
    .slice(0, 5);
  const ready = orders.filter((c) => isReadyStage(byBoard.get(c.boardId), c.stageKey));

  // Batches planned but not yet boiling: still in their board's entry stage.
  const waitingBatches = all.filter((c) => {
    const board = byBoard.get(c.boardId);
    return board?.kind === "production" && c.stageKey === board.graph.entry;
  });
  const toBoil = waitingBatches.reduce((sum, c) => sum + batchQty(c, cardsById), 0);
  const loss = settings.data?.expectedLossPerBatch ?? 0;

  const unpaid = Object.values(money.data ?? {}).reduce((sum, m) => {
    const card = cardsById.get(m.cardId);
    // Only goods already handed over count as owed; an order not yet sent isn't a debt.
    return card && m.cogs > 0 ? sum + Math.max(0, m.revenue - m.paid) : sum;
  }, 0);

  const returnToday = (lots.data ?? []).filter((l) => l.daysLeft <= 0);
  const returnTomorrow = (lots.data ?? []).filter((l) => l.daysLeft === 1);
  const loading = boards.isPending || cards.isPending;

  return (
    <Page title={t("nav.today")} subtitle={longDate()}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t("today.ordersDue")} value={count(dueNow.length)} href="/papan" />
        <StatTile
          label={t("today.toBoil")}
          value={count(toBoil > 0 ? toBoil + loss : 0)}
          href="/papan"
        />
        <StatTile label={t("today.ready")} value={count(ready.length)} href="/papan" />
        {isOwner && (
          <StatTile
            label={t("today.unpaid")}
            value={rupiah(unpaid)}
            href="/uang"
            tone={unpaid > 0 ? "warning" : undefined}
          />
        )}
      </div>

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

      <Section title={t("today.dueList")}>
        {loading ? (
          <EmptyState>{t("auth.loading")}</EmptyState>
        ) : dueNow.length ? (
          dueNow.map((c) => <CardRow key={c.id} card={c} board={byBoard.get(c.boardId)} />)
        ) : (
          <EmptyState>
            {t("today.noOrders")}{" "}
            <Link href="/papan?aksi=baru" className="font-semibold text-primary">
              + {t("order.new")}
            </Link>
          </EmptyState>
        )}
      </Section>

      {upcoming.length > 0 && (
        <Section title={t("today.upcoming")}>
          {upcoming.map((c) => (
            <CardRow key={c.id} card={c} board={byBoard.get(c.boardId)} />
          ))}
        </Section>
      )}

      {orders.length > 0 && ready.length === 0 && dueNow.length === 0 && (
        <p className="text-center text-label text-muted-foreground">
          {t("today.openOrders").replace("{n}", count(orders.length))} ·{" "}
          {count(orders.reduce((s, c) => s + cardQty(c), 0))} {t("unit.egg")}
        </p>
      )}
    </Page>
  );
}
