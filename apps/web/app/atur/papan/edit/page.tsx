"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BoardCanvas } from "@/components/board-editor/canvas";
import { StageList } from "@/components/board-editor/stage-list";
import { EmptyState, Page, ghostButton, primaryButton } from "@/components/ui";
import { useBoardDraft, usePublishBoard } from "@/lib/board-editor";
import { t } from "@/lib/i18n";
import { useBoards, useFieldDefs, useOpenCards, type Board } from "@/lib/queries";
import { useSession } from "@/lib/session";

// S21 Board editor. Changes stay in a draft until published as a new version.
function EditorScreen() {
  const id = useSearchParams().get("id");
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";
  const boards = useBoards();
  const board = (boards.data ?? []).find((b) => b.id === id);

  if (!isOwner) {
    return (
      <Page title={t("editor.title")}>
        <EmptyState>{t("editor.ownerOnly")}</EmptyState>
      </Page>
    );
  }
  if (!board || state.status !== "signed_in" || !state.workspace) {
    return (
      <Page title={t("editor.title")}>
        <EmptyState>{boards.isPending ? t("auth.loading") : t("editor.notFound")}</EmptyState>
      </Page>
    );
  }
  return <Editor key={board.versionId} board={board} workspaceId={state.workspace.id} />;
}

function Editor({ board, workspaceId }: { board: Board; workspaceId: string }) {
  const router = useRouter();
  const draft = useBoardDraft(board);
  const publish = usePublishBoard();
  const fields = useFieldDefs(board.cardTypeId);
  const cards = useOpenCards();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardsIn = (key: string) =>
    (cards.data ?? []).filter((c) => c.boardId === board.id && c.stageKey === key).length;

  async function onPublish() {
    setBusy(true);
    setError(null);
    try {
      await publish(board, workspaceId, draft.graph);
      draft.markSaved();
      router.push("/atur/papan");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title={board.name} subtitle={t("editor.title")}>
      <p className="text-label text-muted-foreground">{t("editor.draftNote")}</p>
      {/* Phones get the stage list; wider screens get the canvas with arrows. */}
      <div className="lg:hidden">
        <StageList draft={draft} defs={fields.data ?? []} cardsIn={cardsIn} />
      </div>
      <div className="hidden lg:block">
        <BoardCanvas draft={draft} defs={fields.data ?? []} cardsIn={cardsIn} />
      </div>

      <div className="sticky bottom-20 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm">
        {draft.problems.map((p) => (
          <p key={p} className="text-label text-danger">
            {p}
          </p>
        ))}
        {error && (
          <p role="alert" className="text-label text-danger">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!draft.dirty || busy}
            onClick={draft.reset}
            className={ghostButton}
          >
            {t("editor.discard")}
          </button>
          <button
            type="button"
            disabled={!draft.dirty || busy || draft.problems.length > 0}
            onClick={() => void onPublish()}
            className={`${primaryButton} flex-1`}
          >
            {busy ? t("editor.publishing") : t("editor.publish")}
          </button>
        </div>
      </div>
    </Page>
  );
}

export default function BoardEditorPage() {
  return (
    <Suspense>
      <EditorScreen />
    </Suspense>
  );
}
