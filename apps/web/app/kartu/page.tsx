"use client";

import { transitionOptions, type TransitionOption } from "@domain";
import { Check, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CardRow } from "@/components/card-row";
import { FieldInput, fieldText } from "@/components/field-input";
import {
  DELIVERY_CHIPS,
  MoneyChips,
  PaymentFields,
  PaymentSheet,
  type PayMethod,
} from "@/components/payment";
import {
  EmptyState,
  Page,
  Section,
  StagePill,
  ghostButton,
  primaryButton,
  secondaryButton,
  stageStyle,
  ListSkeleton,
} from "@/components/ui";
import { boardMap, ruleData, stockReader } from "@/lib/board-model";
import { useEnqueue, useFailedOps, usePendingOps } from "@/lib/data";
import { refusedText } from "@/lib/engine";
import { count, rupiah, shortDate, time } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  cardQty,
  cardTotal,
  useBoards,
  useCard,
  useCardEvents,
  useFieldDefs,
  useLinkedCards,
  useOrderMoney,
  useProducts,
  useStockLevels,
  useVersionGraph,
  type Card,
  type CardEvent,
  type FieldDef,
} from "@/lib/queries";
import { useSession } from "@/lib/session";

// S05 Card detail: where the card is, what can happen next, its money and its history.
function CardScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const { state } = useSession();
  const isOwner = state.status === "signed_in" && state.workspace?.role === "owner";
  const card = useCard(id);
  const boards = useBoards();
  const board = boardMap(boards.data).get(card.data?.boardId ?? "");
  const graph = useVersionGraph(card.data?.versionId);
  const fields = useFieldDefs(board?.cardTypeId);
  const stock = useStockLevels();
  const events = useCardEvents(id);
  const money = useOrderMoney();
  const products = useProducts();
  const linked = useLinkedCards(card.data ?? undefined);
  const pending = usePendingOps().filter((p) => p.input.cardId === id);
  const { failures, dismiss } = useFailedOps();
  const failed = failures.filter((f) => f.item.input.cardId === id);

  if (card.isPending || boards.isPending) {
    return (
      <Page back guide="kartu" title={t("card.title")}>
        <ListSkeleton />
      </Page>
    );
  }
  if (!card.data || !board) {
    return (
      <Page back guide="kartu" title={t("card.title")}>
        <EmptyState>{t("card.notFound")}</EmptyState>
      </Page>
    );
  }

  const c = card.data;
  const g = graph.data ?? board.graph;
  const stageIndex = g.stages.findIndex((s) => s.key === c.stageKey);
  const stage = g.stages[stageIndex];
  const defs = new Map((fields.data ?? []).map((f) => [f.key, f]));
  const options =
    c.status === "open"
      ? transitionOptions(g, c.stageKey, {
          card: ruleData(c),
          stockAvailable: stockReader(stock.data),
        })
      : [];
  const orderMoney = money.data?.[c.id];
  const due = Math.max(0, cardTotal(c) - (orderMoney?.paid ?? 0));
  const productName = new Map((products.data ?? []).map((p) => [p.id, p.name]));

  return (
    <Page
      back
      guide="kartu"
      title={`${c.title} #${c.number}`}
      subtitle={board.name}
      actions={
        <Link href={`/papan?b=${board.id}`} className={ghostButton}>
          {t("card.toBoard")}
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <StagePill name={stage?.name ?? c.stageKey} color={stage?.color} />
        {c.partyName && <span>{c.partyName}</span>}
        {c.dueAt && (
          <span>
            {t("card.due")} {shortDate(c.dueAt)}
          </span>
        )}
        {c.flags.includes("shortage") && <span className="text-warning">{t("card.shortage")}</span>}
      </div>

      <ol aria-label={t("card.stages")} className="flex flex-wrap gap-1">
        {g.stages.map((s, i) => {
          const done = i < stageIndex;
          const current = i === stageIndex;
          return (
            <li
              key={s.key}
              aria-current={current ? "step" : undefined}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-caption font-medium ${
                current ? "" : "opacity-60"
              }`}
              style={current || done ? stageStyle(s.color) : undefined}
            >
              {done && <Check aria-hidden size={12} />}
              {s.name}
            </li>
          );
        })}
      </ol>

      {pending.length > 0 && (
        <p className="rounded-md bg-surface-muted p-2 text-label">{t("card.sending")}</p>
      )}
      {failed.map((f) => (
        <div
          key={f.item.id}
          role="alert"
          className="rounded-md border border-danger p-2 text-label"
        >
          <p className="text-danger">{refusedText(f.error)}</p>
          <button className={ghostButton} onClick={() => dismiss(f.item.id)}>
            {t("card.dismiss")}
          </button>
        </div>
      ))}

      {c.status === "open" ? (
        <>
          <NextSteps card={c} options={options} defs={defs} stageNames={g.stages} due={due} />
          {c.lines.length > 0 && due > 0 && (
            <Link href={`/kartu?id=${c.id}&aksi=bayar`} className={secondaryButton}>
              {t("pay.title")}
            </Link>
          )}
        </>
      ) : (
        <p className="rounded-md bg-surface-muted p-3 font-medium">
          {t(c.status === "done" ? "card.done" : "card.cancelled")}
        </p>
      )}

      {c.lines.length > 0 && (
        <Section title={t("card.items")}>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {c.lines.map((l, i) => (
              <li key={i} className="flex justify-between p-3">
                <span>
                  {count(l.qty)} × {productName.get(l.productId) ?? "–"}
                </span>
                <span className="tabular-nums">{rupiah(l.qty * l.unitPrice)}</span>
              </li>
            ))}
            <li className="flex justify-between p-3 font-semibold">
              <span>
                {t("card.total")} ({count(cardQty(c))} {t("unit.egg")})
              </span>
              <span className="tabular-nums">{rupiah(cardTotal(c))}</span>
            </li>
          </ul>
        </Section>
      )}

      {isOwner && orderMoney && (
        <Section title={t("card.profit")}>
          <dl className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3">
            <Row label={t("profit.revenue")} value={rupiah(orderMoney.revenue)} />
            <Row label={t("profit.cogs")} value={`− ${rupiah(orderMoney.cogs)}`} />
            <Row label={t("profit.direct")} value={`− ${rupiah(orderMoney.directCosts)}`} />
            <Row label={t("profit.profit")} value={rupiah(orderMoney.profit)} strong />
            <Row label={t("profit.paid")} value={rupiah(orderMoney.paid)} />
            <Row
              label={t("profit.remaining")}
              value={rupiah(Math.max(0, orderMoney.revenue - orderMoney.paid))}
            />
          </dl>
        </Section>
      )}

      {(fields.data ?? []).length > 0 && (
        <Section title={t("card.info")}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-3">
            {(fields.data ?? []).map((f) => (
              <div key={f.key} className="flex flex-col">
                <dt className="text-caption text-muted-foreground">{f.label}</dt>
                <dd>{fieldText(f, c.fields[f.key])}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {(linked.data ?? []).length > 0 && (
        <Section title={t("card.linked")}>
          {(linked.data ?? []).map((l) => (
            <CardRow key={l.id} card={l} board={boardMap(boards.data).get(l.boardId)} />
          ))}
        </Section>
      )}

      <Section title={t("card.history")}>
        <History
          events={events.data ?? []}
          stageName={(k) => g.stages.find((s) => s.key === k)?.name ?? k}
        />
      </Section>
      {params.get("aksi") === "bayar" && (
        <PaymentSheet card={c} due={due} onClose={() => router.replace(`/kartu?id=${c.id}`)} />
      )}
    </Page>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between ${strong ? "border-t border-border pt-1 font-bold" : ""}`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

const DELIVERY = "ongkir";
const PAID = "jumlah_bayar";
const METHOD = "metode_bayar";

// The arrows out of the current stage. A stage that needs fields asks for them first; an arrow
// whose rule doesn't hold is shown greyed with its label, so the owner sees why.
function NextSteps({
  card,
  options,
  defs,
  stageNames,
  due,
}: {
  card: Card;
  options: TransitionOption[];
  defs: Map<string, FieldDef>;
  stageNames: { key: string; name: string }[];
  due: number;
}) {
  const enqueue = useEnqueue();
  const [asking, setAsking] = useState<TransitionOption | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const nameOf = (k: string) => stageNames.find((s) => s.key === k)?.name ?? k;

  function move(option: TransitionOption, fields?: Record<string, unknown>) {
    void enqueue("move-card", {
      cardId: card.id,
      to: option.transition.to,
      rowVersion: card.rowVersion,
      ...(fields && Object.keys(fields).length ? { fields } : {}),
    });
    setAsking(null);
    setValues({});
  }

  // Dibayar starts at what's still owed, paid in cash unless changed.
  function ask(option: TransitionOption) {
    setAsking(option);
    setValues(
      option.missingFields.includes(PAID)
        ? { [PAID]: due, ...(defs.has(METHOD) ? { [METHOD]: "cash" } : {}) }
        : {},
    );
  }

  if (options.length === 0) return <p className="text-muted-foreground">{t("card.noNext")}</p>;

  if (asking) {
    const missing = asking.missingFields;
    const complete = missing.every((k) => values[k] !== undefined && values[k] !== "");
    return (
      <form
        className="flex flex-col gap-3 rounded-lg border border-primary p-3"
        onSubmit={(e) => {
          e.preventDefault();
          move(asking, values);
        }}
      >
        <p className="font-semibold">
          {t("card.moveTo")} {nameOf(asking.transition.to)}
        </p>
        {missing.map((k) => {
          if (k === PAID) {
            return (
              <PaymentFields
                key={k}
                due={due}
                amount={Number(values[PAID]) || 0}
                method={(values[METHOD] as PayMethod | undefined) ?? "cash"}
                onAmount={(n) => setValues((s) => ({ ...s, [PAID]: n }))}
                onMethod={(m) => setValues((s) => ({ ...s, [METHOD]: m }))}
              />
            );
          }
          const def = defs.get(k) ?? {
            key: k,
            label: k,
            type: "text",
            required: true,
            options: [],
          };
          return (
            <div key={k} className="flex flex-col gap-2">
              <FieldInput
                def={{ ...def, required: true }}
                value={values[k]}
                onChange={(v) => setValues((s) => ({ ...s, [k]: v }))}
              />
              {k === DELIVERY && (
                <MoneyChips
                  chips={DELIVERY_CHIPS.map((n) => ({ label: rupiah(n), amount: n }))}
                  value={values[k]}
                  onChange={(n) => setValues((s) => ({ ...s, [k]: n }))}
                />
              )}
            </div>
          );
        })}
        <button type="submit" disabled={!complete} className={primaryButton}>
          {t("card.moveTo")} {nameOf(asking.transition.to)}
        </button>
        <button type="button" onClick={() => setAsking(null)} className={ghostButton}>
          {t("setup.back")}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {options.map((o, i) => {
        const ruleBlocked = !o.allowed && o.missingFields.length === 0;
        const label = o.transition.label ?? nameOf(o.transition.to);
        return (
          <button
            key={o.transition.to}
            disabled={ruleBlocked}
            onClick={() => (o.missingFields.length ? ask(o) : move(o))}
            className={i === 0 && !ruleBlocked ? primaryButton : secondaryButton}
          >
            {label}
            {o.transition.label && (
              <span className="font-normal opacity-80"> → {nameOf(o.transition.to)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Newest first. The latest manual move can be undone; undo also reverses whatever it triggered.
function History({
  events,
  stageName,
}: {
  events: CardEvent[];
  stageName: (key: string) => string;
}) {
  const enqueue = useEnqueue();
  const covered = new Set(
    events.flatMap((e) =>
      e.type === "undone" ? ((e.payload.covered as unknown[] | undefined) ?? []).map(String) : [],
    ),
  );
  const undoable = events.find(
    (e) => e.type === "moved" && e.payload.auto !== true && !covered.has(String(e.id)),
  );

  if (events.length === 0) return <EmptyState>{t("card.noHistory")}</EmptyState>;
  return (
    <ol className="flex flex-col gap-2">
      {events.map((e) => (
        <li
          key={e.id}
          className={`flex items-center justify-between gap-2 text-label ${
            covered.has(String(e.id)) ? "line-through opacity-60" : ""
          }`}
        >
          <span>
            <span className="text-muted-foreground">
              {shortDate(e.createdAt)} {time(e.createdAt)}
            </span>{" "}
            {describe(e, stageName)}
          </span>
          {undoable?.id === e.id && (
            <button
              onClick={() => void enqueue("undo", { eventId: e.id })}
              className={`${ghostButton} flex items-center gap-1`}
            >
              <Undo2 aria-hidden size={16} />
              {t("card.undo")}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

function describe(e: CardEvent, stageName: (key: string) => string): string {
  switch (e.type) {
    case "created":
      return t("event.created");
    case "moved":
      return `${t("event.moved")} ${stageName(e.toStage ?? "")}${e.payload.auto ? ` (${t("event.auto")})` : ""}`;
    case "undone":
      return t("event.undone");
    case "field_changed":
      return t("event.fieldChanged");
    default:
      return e.type;
  }
}

export default function CardPage() {
  return (
    <Suspense>
      <CardScreen />
    </Suspense>
  );
}
