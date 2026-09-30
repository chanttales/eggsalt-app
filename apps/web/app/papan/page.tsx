"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CardRow } from "@/components/card-row";
import { NewCardSheet } from "@/components/new-card-sheet";
import { EmptyState, Page, StagePill, stageStyle } from "@/components/ui";
import { t } from "@/lib/i18n";
import { useBoards, useOpenCards, type Board, type Card } from "@/lib/queries";

type View = "kanban" | "list";

// S04 Board. Phones get no sideways scrolling: boards in a 2-column grid, stage filter chips that
// wrap, and the cards stacked by stage. Wide screens keep the kanban columns and a list view.
function BoardScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const boards = useBoards();
  const cards = useOpenCards();

  const list = boards.data ?? [];
  const board = list.find((b) => b.id === params.get("b")) ?? list[0];
  const view: View = params.get("v") === "list" ? "list" : "kanban";
  const stageFilter = params.get("s");
  const onBoard = (cards.data ?? []).filter((c) => c.boardId === board?.id);

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
    router.replace(`/papan?${q.toString()}`);
  }

  return (
    <Page
      title={t("nav.boards")}
      actions={
        board && (
          <Link
            href={`/papan?b=${board.id}&aksi=baru`}
            className="flex min-h-touch items-center gap-1 rounded-md bg-primary px-3 font-semibold text-primary-foreground"
          >
            <Plus aria-hidden size={20} />
            {t("board.newCard")}
          </Link>
        )
      }
    >
      <div role="tablist" className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">
        {list.map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={b.id === board?.id}
            onClick={() => go({ b: b.id })}
            className={`min-h-touch rounded-lg border px-3 py-2 text-left text-label leading-tight font-medium lg:rounded-full lg:px-4 ${
              b.id === board?.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface"
            }`}
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
        <EmptyState>{t("auth.loading")}</EmptyState>
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

      {board && params.get("aksi") === "baru" && (
        <NewCardSheet board={board} onClose={() => router.replace(`/papan?b=${board.id}`)} />
      )}
    </Page>
  );
}

// Phone view: filter chips wrap onto new lines instead of scrolling, and cards stack under a
// header per stage. Picking a stage shows only that stage; "Semua" shows every stage that has cards.
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
  const shown = stages.filter((s) =>
    stage ? s.key === stage : cards.some((c) => c.stageKey === s.key),
  );
  const chip = (active: boolean) =>
    `flex min-h-touch items-center gap-1.5 rounded-full border px-3 text-label font-medium ${
      active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface"
    }`;
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("card.stages")} className="flex flex-wrap gap-2">
        <button
          role="tab"
          aria-selected={!stage}
          onClick={() => onStage(null)}
          className={chip(!stage)}
        >
          {t("board.all")} <span className="tabular-nums opacity-70">{cards.length}</span>
        </button>
        {stages.map((s) => {
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
