"use client";

import type { Condition } from "@domain";
import { inputClass } from "@/components/ui";
import { simpleRule, type Compare } from "@/lib/board-editor";
import { t } from "@/lib/i18n";
import type { FieldDef } from "@/lib/queries";

const OPS = ["eq", "ne", "gt", "gte", "lt", "lte"] as const;

/** Card data a rule can look at: quantity, total, customer type, and the card type's fields. */
export function ruleFields(defs: FieldDef[]): { path: string; label: string; numeric: boolean }[] {
  return [
    { path: "lines.qty", label: t("editor.path.qty"), numeric: true },
    { path: "lines.total", label: t("editor.path.total"), numeric: true },
    { path: "party.segment", label: t("editor.path.segment"), numeric: false },
    ...defs.map((d) => ({
      path: `fields.${d.key}`,
      label: d.label,
      numeric: d.type === "number" || d.type === "money",
    })),
  ];
}

export function ruleText(when: Condition | undefined, defs: FieldDef[]): string {
  const rule = simpleRule(when);
  if (rule === undefined) return "";
  if (rule === null) return t("editor.advancedRule");
  const field = ruleFields(defs).find((f) => f.path === rule.field)?.label ?? rule.field;
  return `${field} ${t(`editor.op.${rule.op as (typeof OPS)[number]}`)} ${String(rule.value)}`;
}

// "Only when <field> <op> <value>": one comparison, enough for rules like "Jumlah ≥ 40".
export function RuleEditor({
  when,
  defs,
  onChange,
}: {
  when: Condition | undefined;
  defs: FieldDef[];
  onChange: (when: Condition | undefined) => void;
}) {
  const rule = simpleRule(when);
  const fields = ruleFields(defs);
  if (rule === null) {
    return (
      <div className="flex items-center justify-between gap-2 text-label">
        <span>{t("editor.advancedRule")}</span>
        <button type="button" className="text-danger" onClick={() => onChange(undefined)}>
          {t("editor.removeRule")}
        </button>
      </div>
    );
  }
  if (!rule) {
    return (
      <button
        type="button"
        className="self-start text-label font-medium text-primary"
        onClick={() => onChange({ field: "lines.qty", op: "gte", value: 1 })}
      >
        + {t("editor.addRule")}
      </button>
    );
  }
  const numeric = fields.find((f) => f.path === rule.field)?.numeric ?? false;
  const set = (patch: Partial<Compare>) => onChange({ ...rule, ...patch } as Compare);
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-muted p-2">
      <span className="text-caption text-muted-foreground">{t("editor.onlyWhen")}</span>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
        <select
          aria-label={t("editor.ruleField")}
          value={rule.field}
          onChange={(e) => set({ field: e.target.value })}
          className={inputClass}
        >
          {fields.map((f) => (
            <option key={f.path} value={f.path}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          aria-label={t("editor.ruleOp")}
          value={rule.op}
          onChange={(e) => set({ op: e.target.value as Compare["op"] })}
          className={inputClass}
        >
          {OPS.map((op) => (
            <option key={op} value={op}>
              {t(`editor.op.${op}`)}
            </option>
          ))}
        </select>
        <input
          aria-label={t("editor.ruleValue")}
          inputMode={numeric ? "numeric" : "text"}
          value={rule.value === null || Array.isArray(rule.value) ? "" : String(rule.value)}
          onChange={(e) =>
            set({ value: numeric ? Number(e.target.value.replace(/\D/g, "")) : e.target.value })
          }
          className={inputClass}
        />
      </div>
      <button
        type="button"
        className="self-start text-label text-danger"
        onClick={() => onChange(undefined)}
      >
        {t("editor.removeRule")}
      </button>
    </div>
  );
}
