"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Switch } from "@/components/checkbox";
import { CardRow } from "@/components/card-row";
import { NewCardSheet } from "@/components/new-card-sheet";
import { Sheet } from "@/components/sheet";
import {
  EmptyState,
  Page,
  segment,
  segmented,
  StagePill,
  stageStyle,
  ListSkeleton,
} from "@/components/ui";
import { t } from "@/lib/i18n";
import { useBoards, useDoneCards, useOpenCards, type Board, type Card } from "@/lib/queries";

type View = "kanban" | "list";

// Pesanan. Phones get pill tabs for the order lists, one scrolling row of
// stage chips, and the cards stacked by stage. Wide screens keep the kanban columns and a list view.
function BoardScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const boards = useBoards();
  const cards = useOpenCards();
  const done = useDoneCards();

  // The order boards (Pesanan, Pre-order). An old link to another board still opens it.
  const all = boards.data ?? [];
  const orderBoards = all.filter((b) => b.kind === "order");
  const board = all.find((b) => b.id === params.get("b")) ?? orderBoards[0] ?? all[0];
  const list = board && !orderBoards.includes(board) ? [...orderBoards, board] : orderBoards;
  const view: View = params.get("v") === "list" ? "list" : "kanban";
  const stageFilter = params.get("s");
  // Finished orders stay listed under their last stage (Selesai) for 30 days.
  const onBoard = [...(cards.data ?? []), ...(done.data ?? [])].filter(
    (c) => c.boardId === board?.id,
  );

  function go(next: { b?: string; v?: View; s?: string | null }) {
    const q = new URLSearchParams(params.toString());
    if (next.b) {
      q.set("b", next.b);
      q.delete("s");
    }
    if (next.v) q.set("v", next.v);
    if (next.s !== undefined) {
      if (next.s) q.set("s", next.s);
      else q.delete("s");
    }
    // Only the query changes: update it in place so the list swaps without a page load.
    window.history.replaceState(null, "", `?${q.toString()}`);
  }

  return (
    // No add button here: the + in the nav adds orders.
    <Page guide="papan" title={t("nav.orders")}>
      <div role="tablist" className={segmented}>
        {list.map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={b.id === board?.id}
            onClick={() => go({ b: b.id })}
            className={segment(b.id === board?.id)}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="hidden gap-2 text-label lg:flex">
        {(["kanban", "list"] as const).map((v) => (
          <button
            key={v}
            onClick={() => go({ v })}
            aria-pressed={view === v}
            className={`min-h-touch rounded-md px-3 font-medium ${
              view === v ? "bg-surface-muted" : "text-muted-foreground"
            }`}
          >
            {t(v === "kanban" ? "board.kanban" : "board.list")}
          </button>
        ))}
      </div>

      {boards.isPending || cards.isPending ? (
        <ListSkeleton />
      ) : !board ? (
        <EmptyState>{t("board.none")}</EmptyState>
      ) : (
        <>
          <div className="lg:hidden">
            <Stacked
              board={board}
              cards={onBoard}
              stage={stageFilter}
              onStage={(key) => go({ s: key })}
            />
          </div>
          <div className="hidden lg:block">
            {view === "kanban" ? (
              <Kanban board={board} cards={onBoard} />
            ) : onBoard.length ? (
              <div className="flex flex-col gap-2">
                {onBoard.map((c) => (
                  <CardRow key={c.id} card={c} board={board} />
                ))}
              </div>
            ) : (
              <EmptyState>{t("board.empty")}</EmptyState>
            )}
          </div>
        </>
      )}

      {params.get("aksi") === "baru" && !params.get("b") && orderBoards.length > 1 ? (
        // The + button: pick Pesanan or Pre-order first.
        <Sheet title={t("order.new")} onClose={() => router.replace("/papan")}>
          {orderBoards.map((b) => (
            <button
              key={b.id}
              onClick={() => router.replace(`/papan?b=${b.id}&aksi=baru`)}
              className="flex min-h-touch items-center justify-between rounded-[14px] bg-primary-soft px-4 py-3 text-left font-semibold"
            >
              {b.name}
              <ArrowRight aria-hidden size={20} className="text-primary" />
            </button>
          ))}
        </Sheet>
      ) : (
        board &&
        params.get("aksi") === "baru" && (
          <NewCardSheet board={board} onClose={() => router.replace(`/papan?b=${board.id}`)} />
        )
      )}
    </Page>
  );
}

// Phone view: filter chips sit on one row that scrolls sideways, and cards stack under a
// header per stage. Picking a stage shows only that stage; "Semua" shows every stage that has cards.
// Chips for empty stages stay hidden until "Tampilkan semua tahap" is ticked.
function Stacked({
  board,
  cards,
  stage,
  onStage,
}: {
  board: Board;
  cards: Card[];
  stage: string | null;
  onStage: (key: string | null) => void;
}) {
  const stages = board.graph.stages;
  const [allStages, setAllStages] = useState(false);
  const chips = stages.filter(
    (s) => allStages || s.key === stage || cards.some((c) => c.stageKey === s.key),
  );
  const shown = stages.filter((s) =>
    stage ? s.key === stage : cards.some((c) => c.stageKey === s.key),
  );
  const chip = (active: boolean) =>
    `flex min-h-touch shrink-0 items-center gap-1.5 rounded-full border px-3 text-label font-medium whitespace-nowrap ${
      active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface"
    }`;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 self-start text-label text-muted-foreground">
        <Switch checked={allStages} onChange={setAllStages} />
        {t("board.allStages")}
      </label>
      <div
        role="tablist"
        aria-label={t("card.stages")}
        className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4"
      >
        <button
          role="tab"
          aria-selected={!stage}
          onClick={() => onStage(null)}
          className={chip(!stage)}
        >
          {t("board.all")} <span className="tabular-nums opacity-70">{cards.length}</span>
        </button>
        {chips.map((s) => {
          const n = cards.filter((c) => c.stageKey === s.key).length;
          return (
            <button
              key={s.key}
              role="tab"
              aria-selected={stage === s.key}
              onClick={() => onStage(stage === s.key ? null : s.key)}
              className={chip(stage === s.key)}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: stageStyle(s.color).color }}
              />
              {s.name} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState>{t("board.empty")}</EmptyState>
      ) : (
        shown.map((s) => {
          const inStage = cards.filter((c) => c.stageKey === s.key);
          return (
            <section key={s.key} aria-label={s.name} className="flex flex-col gap-2">
              <header className="sticky top-0 z-10 flex items-center justify-between bg-background py-1">
                <StagePill name={s.name} color={s.color} />
                <span className="text-label font-semibold tabular-nums">{inStage.length}</span>
              </header>
              {inStage.length ? (
                inStage.map((c) => <CardRow key={c.id} card={c} board={board} />)
              ) : (
                <EmptyState>{t("board.emptyStage")}</EmptyState>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function Kanban({ board, cards }: { board: Board; cards: Card[] }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
      {board.graph.stages.map((stage) => {
        const inStage = cards.filter((c) => c.stageKey === stage.key);
        return (
          <section
            key={stage.key}
            aria-label={stage.name}
            className="flex w-[85%] max-w-72 shrink-0 snap-start flex-col gap-2 rounded-lg bg-surface-muted p-2"
          >
            <header className="flex items-center justify-between px-1 py-1">
              <StagePill name={stage.name} color={stage.color} />
              <span className="text-label font-semibold tabular-nums">{inStage.length}</span>
            </header>
            {inStage.map((c) => (
              <CardRow key={c.id} card={c} board={board} />
            ))}
            {stage.key === board.graph.entry && (
              <Link
                href={`/papan?b=${board.id}&aksi=baru`}
                className="flex min-h-touch items-center justify-center gap-1 rounded-md text-label font-semibold text-primary"
              >
                <Plus aria-hidden size={16} />
                {t("board.newCard")}
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function BoardsPage() {
  return (
    <Suspense>
      <BoardScreen />
    </Suspense>
  );
}
