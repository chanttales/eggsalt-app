"use client";

import Link from "next/link";
import { EmptyState, Page, StagePill, ListSkeleton } from "@/components/ui";
import { t } from "@/lib/i18n";
import { useBoards } from "@/lib/queries";
import { useSession } from "@/lib/session";

// S20 Atur papan: the boards, each opening the editor.
export default function BoardSetupPage() {
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";
  const boards = useBoards();

  return (
    <Page back="/profil" guide="atur" title={t("editor.boards")}>
      {!isOwner ? (
        <EmptyState>{t("editor.ownerOnly")}</EmptyState>
      ) : (boards.data ?? []).length === 0 ? (
        boards.isPending ? (
          <ListSkeleton />
        ) : (
          <EmptyState>{t("board.none")}</EmptyState>
        )
      ) : (
        (boards.data ?? []).map((b) => (
          <Link
            key={b.id}
            href={`/atur/papan/edit?id=${b.id}`}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
          >
            <span className="font-semibold">{b.name}</span>
            <span className="flex flex-wrap gap-1">
              {b.graph.stages.map((s) => (
                <StagePill key={s.key} name={s.name} color={s.color} />
              ))}
            </span>
          </Link>
        ))
      )}
    </Page>
  );
}
