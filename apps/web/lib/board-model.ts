import type { Stage } from "@domain";
import { dayKey } from "@/lib/format";
import { cardQty, type Board, type Card } from "@/lib/queries";

// Screen-level readings of the board graphs the owner draws. Nothing here hard-codes the Telur Asin
// stage names: "ready", "sold" and "paid" are found from what each stage does when a card enters it.

export function boardMap(boards: Board[] | undefined): Map<string, Board> {
  return new Map((boards ?? []).map((b) => [b.id, b]));
}

export function stageOf(board: Board | undefined, key: string): Stage | undefined {
  return board?.graph.stages.find((s) => s.key === key);
}

export function isTerminal(board: Board | undefined, key: string): boolean {
  return Boolean(board?.graph.terminal.includes(key));
}

/** Entering this stage takes the goods out of stock as a sale (Dikirim, Diambil). */
export function isSaleStage(stage: Stage | undefined): boolean {
  return Boolean(stage?.onEnter.some((a) => a.action === "move_stock" && a.reason === "sale"));
}

/** Stages from which a card can go straight to a sale stage: ready to hand over. */
export function isReadyStage(board: Board | undefined, key: string): boolean {
  if (!board) return false;
  return board.graph.transitions.some((t) => t.from === key && isSaleStage(stageOf(board, t.to)));
}

/** How many eggs a production card will boil: its own count, else the order that created it. */
export function batchQty(card: Card, cardsById: Map<string, Card>): number {
  const own = Number(card.fields.jumlah_rebus);
  if (Number.isFinite(own) && own > 0) return own;
  const parent = card.parentCardId ? cardsById.get(card.parentCardId) : undefined;
  return parent ? cardQty(parent) : 0;
}

/** Due date of a card as a Jakarta calendar day, if it has one. */
export function dueDay(card: Card): string | null {
  return card.dueAt ? dayKey(card.dueAt) : null;
}
