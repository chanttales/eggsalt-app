// Board graph: the workflow an owner draws (stages, arrows with rules, actions on entering a stage).
// Stored as JSON in board_version.graph and validated here, so the app, the engine and the editor
// all agree on what a valid board is. Stage keys are stable ids; renaming a stage changes `name` only.

import { z } from "zod";

export const STAGE_COLORS = [
  "gray",
  "teal",
  "blue",
  "violet",
  "pink",
  "orange",
  "amber",
  "green",
] as const;

const key = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,47}$/, "Use lowercase letters, numbers and _ (start with a letter)");

/** "{{lines.qty}}" style reference to card data, resolved by the rule evaluator. */
export const templateRef = z
  .string()
  .regex(/^\{\{\s*[a-z_][a-z0-9_.]*\s*\}\}$/i, "Expected {{field}}");

/** A literal or a {{reference}}. */
export const ruleValue = z.union([z.number(), z.boolean(), z.string(), z.null()]);

/** A quantity: a whole number or a {{reference}} such as {{lines.qty}}. */
const qtyValue = z.union([z.number().int().positive(), templateRef]);

/** A rupiah amount: a whole number or a {{reference}} such as {{fields.ongkir}}. */
const amountValue = z.union([z.number().int().nonnegative(), templateRef]);

export const COMPARE_OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "in"] as const;

const compareCondition = z.strictObject({
  /** Card data path, e.g. "lines.qty", "fields.segment". */
  field: z.string().min(1),
  op: z.enum(COMPARE_OPS),
  value: z.union([ruleValue, z.array(ruleValue)]),
});

const STOCK_OPS = ["eq", "gt", "gte", "lt", "lte"] as const;

/** Stock on hand minus reservations, compared with a quantity, e.g. { state: "matang", gte: "{{lines.qty}}" }. */
const stockAvailableCondition = z
  .strictObject({
    fn: z.literal("stock_available"),
    item: key.optional(),
    state: key,
    eq: qtyValue.optional(),
    gt: qtyValue.optional(),
    gte: qtyValue.optional(),
    lt: qtyValue.optional(),
    lte: qtyValue.optional(),
  })
  .refine(
    (c) => STOCK_OPS.filter((op) => c[op] !== undefined).length === 1,
    "Use exactly one of eq, gt, gte, lt, lte",
  );

export type Condition =
  | z.infer<typeof compareCondition>
  | z.infer<typeof stockAvailableCondition>
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export const condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    compareCondition,
    stockAvailableCondition,
    z.strictObject({ all: z.array(condition).min(1) }),
    z.strictObject({ any: z.array(condition).min(1) }),
    z.strictObject({ not: condition }),
  ]),
);

export const MOVE_REASONS = ["sale", "production_out", "damage", "adjust"] as const;
export const MONEY_KINDS = ["income", "expense", "customer_payment"] as const;

/** The fixed step-action catalog (PRD 5.8). "Require" is the stage's `require` list. */
export const stageAction = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("set_field"), field: key, value: ruleValue }),
  z.strictObject({ action: z.literal("check_stock"), item: key.optional(), state: key }),
  z.strictObject({
    action: z.literal("reserve_stock"),
    item: key.optional(),
    state: key,
    qty: qtyValue,
  }),
  z.strictObject({ action: z.literal("release_reservation"), state: key.optional() }),
  z.strictObject({
    action: z.literal("move_stock"),
    item: key.optional(),
    state: key,
    toState: key.optional(),
    qty: qtyValue,
    reason: z.enum(MOVE_REASONS),
  }),
  z.strictObject({
    action: z.literal("create_linked_card"),
    board: key,
    fields: z.record(key, ruleValue).optional(),
  }),
  z.strictObject({
    action: z.literal("record_money"),
    kind: z.enum(MONEY_KINDS),
    category: key.optional(),
    amount: amountValue,
    /** "card" spreads the cost onto this card, so it counts in the order's profit. */
    allocate: z.enum(["card", "none"]).optional(),
  }),
  z.strictObject({
    action: z.literal("remind"),
    message: z.string().min(1).max(200),
    /** Days relative to `from` (negative = before), e.g. -1 with from "fields.tanggal" for H-1. */
    offsetDays: z.number().int().min(-60).max(60).default(0),
    from: z.string().min(1).optional(),
  }),
]);

export const stage = z.strictObject({
  key,
  name: z.string().trim().min(1).max(40),
  color: z.enum(STAGE_COLORS).default("gray"),
  /** Canvas position [x, y]. */
  pos: z.tuple([z.number(), z.number()]).optional(),
  onEnter: z.array(stageAction).default([]),
  /** Fields that must be filled before a card can enter this stage. */
  require: z.array(key).default([]),
});

export const transition = z.strictObject({
  from: key,
  to: key,
  when: condition.optional(),
  label: z.string().max(40).optional(),
});

export const boardGraph = z
  .strictObject({
    entry: key,
    terminal: z.array(key).default([]),
    stages: z.array(stage).min(1).max(30),
    transitions: z.array(transition).default([]),
  })
  .superRefine((graph, ctx) => {
    const keys = new Set<string>();
    graph.stages.forEach((s, i) => {
      if (keys.has(s.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", i, "key"],
          message: `Duplicate stage ${s.key}`,
        });
      }
      keys.add(s.key);
    });
    const known = (k: string, path: (string | number)[]) => {
      if (!keys.has(k)) ctx.addIssue({ code: "custom", path, message: `Unknown stage ${k}` });
    };
    known(graph.entry, ["entry"]);
    graph.terminal.forEach((k, i) => known(k, ["terminal", i]));
    const arrows = new Set<string>();
    graph.transitions.forEach((t, i) => {
      known(t.from, ["transitions", i, "from"]);
      known(t.to, ["transitions", i, "to"]);
      if (t.from === t.to) {
        ctx.addIssue({
          code: "custom",
          path: ["transitions", i],
          message: "An arrow must go to another stage",
        });
      }
      const id = `${t.from}>${t.to}`;
      if (arrows.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["transitions", i],
          message: `Duplicate arrow ${t.from} → ${t.to}`,
        });
      }
      arrows.add(id);
    });
  });

export type StageAction = z.infer<typeof stageAction>;
export type Stage = z.infer<typeof stage>;
export type Transition = z.infer<typeof transition>;
export type BoardGraph = z.infer<typeof boardGraph>;

/** Parses stored or edited JSON into a board graph, with defaults filled in. Throws a ZodError if invalid. */
export function parseBoardGraph(json: unknown): BoardGraph {
  return boardGraph.parse(json);
}
