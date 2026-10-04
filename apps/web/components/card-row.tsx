import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { StagePill, stageStyle } from "@/components/ui";
import { stageOf } from "@/lib/board-model";
import { count, rupiah, shortDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cardQty, cardTotal, type Board, type Card } from "@/lib/queries";

// A card in a list. Opens the card detail.
export function CardRow({ card, board }: { card: Card; board: Board | undefined }) {
  const stage = stageOf(board, card.stageKey);
  const qty = cardQty(card);
  const total = cardTotal(card);
  return (
    <Link
      href={`/kartu?id=${card.id}`}
      className="flex items-center gap-3 rounded-lg border border-l-4 border-border bg-surface p-3"
      style={{ borderLeftColor: stageStyle(stage?.color).color }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate font-semibold">
          {card.title} <span className="text-muted-foreground">#{card.number}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2 text-label text-muted-foreground">
          <StagePill name={stage?.name ?? card.stageKey} color={stage?.color} />
          {qty > 0 && (
            <span>
              {count(qty)} {t("unit.egg")}
            </span>
          )}
          {card.dueAt && <span>{shortDate(card.dueAt)}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {total > 0 && <span className="font-semibold tabular-nums">{rupiah(total)}</span>}
        {card.flags.includes("shortage") && (
          <span className="flex items-center gap-1 text-caption text-warning">
            <AlertTriangle aria-hidden size={14} />
            {t("card.shortage")}
          </span>
        )}
      </div>
    </Link>
  );
}
