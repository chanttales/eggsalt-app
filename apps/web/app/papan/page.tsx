"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CardRow } from "@/components/card-row";
import { EmptyState, Page, StagePill } from "@/components/ui";
import { t } from "@/lib/i18n";
import { useBoards, useOpenCards, type Board, type Card } from "@/lib/queries";

type View = "kanban" | "list";

// S04 Board: one column per stage, snapping sideways on phone; a list view for quick scanning.
function BoardScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const boards = useBoards();
  const cards = useOpenCards();

  const list = boards.data ?? [];
  const board = list.find((b) => b.id === params.get("b")) ?? list[0];
  const view: View = params.get("v") === "list" ? "list" : "kanban";
  const onBoard = (cards.data ?? []).filter((c) => c.boardId === board?.id);

  function go(next: { b?: string; v?: View }) {
    const q = new URLSearchParams(params.toString());
    if (next.b) q.set("b", next.b);
    if (next.v) q.set("v", next.v);
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
      <div role="tablist" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {list.map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={b.id === board?.id}
            onClick={() => go({ b: b.id })}
            className={`min-h-touch shrink-0 rounded-full border px-4 font-medium ${
              b.id === board?.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface"
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2 text-label">
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
      ) : view === "kanban" ? (
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
    </Page>
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
