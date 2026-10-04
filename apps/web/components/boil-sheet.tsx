"use client";

import { useState } from "react";
import { FieldInput } from "@/components/field-input";
import { QtyStepper, Sheet } from "@/components/sheet";
import { EmptyState, Section, primaryButton, secondaryButton } from "@/components/ui";
import { batchQty } from "@/lib/board-model";
import { useEnqueue } from "@/lib/data";
import { count, rupiah, shortDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  useBoards,
  useFieldDefs,
  useOpenCards,
  useSettings,
  useStockLevels,
  type Board,
  type Card,
} from "@/lib/queries";

const QTY_FIELD = "jumlah_rebus";

// Boil: start the batches waiting to be boiled, then sort a boiled batch into good and broken
// eggs with its LPG cost. Both are moves on the production board, so linked orders, stock and HPP
// follow the board's own rules.
export function BoilSheet({ onClose }: { onClose: () => void }) {
  const boards = useBoards();
  const cards = useOpenCards();
  const settings = useSettings();
  const board = (boards.data ?? []).find((b) => b.kind === "production");
  const all = cards.data ?? [];
  const byId = new Map(all.map((c) => [c.id, c]));

  if (!board) {
    return (
      <Sheet title={t("boil.title")} onClose={onClose}>
        <EmptyState>{t("boil.noBoard")}</EmptyState>
      </Sheet>
    );
  }

  const sortStage = board.graph.stages.find((s) =>
    s.onEnter.some((a) => a.action === "move_stock" && a.reason === "production_out"),
  );
  const startTo = board.graph.transitions.find((t) => t.from === board.graph.entry)?.to;
  const onBoard = all.filter((c) => c.boardId === board.id);
  const waiting = onBoard.filter((c) => c.stageKey === board.graph.entry);
  const boiling = onBoard.filter((c) =>
    board.graph.transitions.some((t) => t.from === c.stageKey && t.to === sortStage?.key),
  );
  const loss = settings.data?.expectedLossPerBatch ?? 0;
  const maxBatch = Number(settings.data?.raw.max_batch_size) || undefined;

  return (
    <Sheet title={t("boil.title")} onClose={onClose}>
      {boiling.length > 0 && sortStage && (
        <Section title={t("boil.sortTitle")}>
          {boiling.map((c) => (
            <SortBatch
              key={c.id}
              card={c}
              board={board}
              sortKey={sortStage.key}
              require={sortStage.require}
              loss={loss}
              lpg={settings.data?.lpgPerBatch ?? 0}
              qty={batchQty(c, byId)}
            />
          ))}
        </Section>
      )}

      <Section title={t("boil.startTitle")}>
        {startTo &&
          waiting.map((c) => {
            const parent = c.parentCardId ? byId.get(c.parentCardId) : undefined;
            return (
              <StartBatch
                key={c.id}
                label={parent ? `${parent.title} #${parent.number}` : `${c.title} #${c.number}`}
                initial={batchQty(c, byId) + (c.fields[QTY_FIELD] ? 0 : loss)}
                max={maxBatch}
                onStart={(qty, enqueue) =>
                  enqueue("move-card", {
                    cardId: c.id,
                    to: startTo,
                    fields: { [QTY_FIELD]: qty },
                  })
                }
              />
            );
          })}
        <StartBatch
          label={t("boil.newBatch")}
          initial={0}
          max={maxBatch}
          onStart={(qty, enqueue) =>
            enqueue("create-card", {
              boardId: board.id,
              title: `${t("boil.batch")} ${shortDate(new Date())}`,
              fields: { [QTY_FIELD]: qty },
            })
          }
        />
      </Section>
    </Sheet>
  );
}

type Enqueue = ReturnType<typeof useEnqueue>;

function StartBatch({
  label,
  initial,
  max,
  onStart,
}: {
  label: string;
  initial: number;
  max?: number;
  onStart: (qty: number, enqueue: Enqueue) => Promise<string>;
}) {
  const enqueue = useEnqueue();
  const stock = useStockLevels();
  const [qty, setQty] = useState(initial);
  const [sent, setSent] = useState(false);
  const raw = (stock.data ?? []).find((l) => l.returnable)?.available;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <p className="font-semibold">{label}</p>
      <QtyStepper value={qty} onChange={setQty} max={max} chips={[10, 20, 30, 40, 50, 60]} />
      {raw !== undefined && qty > raw && (
        <p className="text-label text-warning">{t("boil.notEnough").replace("{n}", count(raw))}</p>
      )}
      <button
        disabled={qty <= 0 || sent}
        onClick={() => {
          setSent(true);
          void onStart(qty, enqueue);
        }}
        className={primaryButton}
      >
        {sent ? t("boil.started") : t("boil.start")}
      </button>
    </div>
  );
}

function SortBatch({
  card,
  board,
  sortKey,
  require,
  qty,
  loss,
  lpg,
}: {
  card: Card;
  board: Board;
  sortKey: string;
  require: string[];
  qty: number;
  loss: number;
  lpg: number;
}) {
  const enqueue = useEnqueue();
  const defs = useFieldDefs(board.cardTypeId);
  const good = Math.max(0, qty - loss);
  const [values, setValues] = useState<Record<string, unknown>>({
    jumlah_bagus: good,
    jumlah_rusak: qty - good,
    biaya_lpg: lpg,
  });
  const [sent, setSent] = useState(false);
  const after = board.graph.transitions.find((t) => t.from === sortKey)?.to;
  const goodNow = Number(values.jumlah_bagus) || 0;
  const cost = Number(values.biaya_lpg) || 0;
  const complete = require.every((k) => values[k] !== undefined && values[k] !== "");

  async function sort() {
    setSent(true);
    // Sorting is the last real step; the batch is then ready. One message for both moves.
    await enqueue(
      "move-card",
      { cardId: card.id, to: sortKey, fields: values },
      { quiet: !!after },
    );
    if (after) await enqueue("move-card", { cardId: card.id, to: after });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary bg-surface p-3">
      <p className="font-semibold">
        {card.title} #{card.number} · {count(qty)} {t("unit.egg")}
      </p>
      {(defs.data ?? [])
        .filter((d) => require.includes(d.key))
        .map((d) => (
          <FieldInput
            key={d.key}
            def={{ ...d, required: true }}
            value={values[d.key]}
            onChange={(v) =>
              setValues((s) => {
                const next = { ...s, [d.key]: v };
                // Whatever isn't good is broken, unless the owner types both.
                if (d.key === "jumlah_bagus" && typeof v === "number") {
                  next.jumlah_rusak = Math.max(0, qty - v);
                }
                return next;
              })
            }
          />
        ))}
      {goodNow > 0 && (
        <p className="text-label text-muted-foreground">
          {t("boil.result").replace("{good}", count(goodNow)).replace("{cost}", rupiah(cost))}
        </p>
      )}
      <button disabled={!complete || sent} onClick={() => void sort()} className={secondaryButton}>
        {sent ? t("boil.sorted") : t("boil.sort")}
      </button>
    </div>
  );
}
