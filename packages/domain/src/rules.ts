// Rule evaluator: decides which arrows a card may take and resolves {{field}} references.
// Pure and synchronous, so the app can preview "what happens next" and the engine can enforce it
// with exactly the same logic. Stock comes in through a callback so callers decide where it's read.

import type { BoardGraph, Condition, Stage, Transition } from "./board";

/** Card data a rule can read, e.g. { lines: { qty: 20 }, fields: { segment: "warung" } }. */
export type CardData = Record<string, unknown>;

export interface RuleContext {
  card: CardData;
  /** Stock on hand minus active reservations for an item state. */
  stockAvailable: (query: { item?: string; state: string }) => number;
}

const TEMPLATE = /^\{\{\s*([a-z_][a-z0-9_.]*)\s*\}\}$/i;

/** Reads a dotted path such as "fields.ongkir"; undefined when any part is missing. */
export function readPath(data: CardData, path: string): unknown {
  let current: unknown = data;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Turns "{{lines.qty}}" into the card's value; other values are returned as they are. */
export function resolveValue(value: unknown, card: CardData): unknown {
  if (typeof value !== "string") return value;
  const match = TEMPLATE.exec(value);
  return match?.[1] ? readPath(card, match[1]) : value;
}

type Op = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in";

function compare(left: unknown, op: Op, right: unknown): boolean {
  switch (op) {
    case "eq":
      return left === right;
    case "ne":
      return left !== right;
    case "in":
      return Array.isArray(right) && right.includes(left);
    default: {
      // Ordering needs two numbers or two strings; anything else (missing field, mixed types) is false.
      const comparable =
        (typeof left === "number" && typeof right === "number") ||
        (typeof left === "string" && typeof right === "string");
      if (!comparable) return false;
      const a = left as number | string;
      const b = right as number | string;
      if (op === "gt") return a > b;
      if (op === "gte") return a >= b;
      if (op === "lt") return a < b;
      return a <= b;
    }
  }
}

const STOCK_OPS = ["eq", "gt", "gte", "lt", "lte"] as const;

export function evaluateCondition(condition: Condition, context: RuleContext): boolean {
  if ("all" in condition) return condition.all.every((c) => evaluateCondition(c, context));
  if ("any" in condition) return condition.any.some((c) => evaluateCondition(c, context));
  if ("not" in condition) return !evaluateCondition(condition.not, context);
  if ("fn" in condition) {
    const available = context.stockAvailable({ item: condition.item, state: condition.state });
    const op = STOCK_OPS.find((o) => condition[o] !== undefined);
    return op ? compare(available, op, resolveValue(condition[op], context.card)) : false;
  }
  const value = Array.isArray(condition.value)
    ? condition.value.map((v) => resolveValue(v, context.card))
    : resolveValue(condition.value, context.card);
  return compare(readPath(context.card, condition.field), condition.op, value);
}

export interface TransitionOption {
  transition: Transition;
  /** False when the arrow's rule doesn't hold for this card right now. */
  allowed: boolean;
  /** Fields the target stage requires that the card hasn't filled in. */
  missingFields: string[];
}

function isFilled(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

/** Required fields of a stage that are still empty in the card's `fields`. */
export function missingRequiredFields(stage: Stage, card: CardData): string[] {
  return stage.require.filter((field) => !isFilled(readPath(card, `fields.${field}`)));
}

/** Every arrow out of `from`, in drawing order, with whether the card may take it now. */
export function transitionOptions(
  graph: BoardGraph,
  from: string,
  context: RuleContext,
): TransitionOption[] {
  const stages = new Map(graph.stages.map((s) => [s.key, s]));
  return graph.transitions
    .filter((t) => t.from === from)
    .map((transition) => {
      const target = stages.get(transition.to);
      const missingFields = target ? missingRequiredFields(target, context.card) : [];
      const ruleHolds = transition.when ? evaluateCondition(transition.when, context) : true;
      return { transition, allowed: ruleHolds && missingFields.length === 0, missingFields };
    });
}

/**
 * Where a card goes automatically from `from`: the first arrow (in drawing order) that has a rule
 * and whose rule holds. Arrows without a rule are manual choices, so they never auto-route.
 */
export function autoRoute(
  graph: BoardGraph,
  from: string,
  context: RuleContext,
): Transition | undefined {
  return transitionOptions(graph, from, context).find(
    (option) => option.transition.when !== undefined && option.allowed,
  )?.transition;
}
