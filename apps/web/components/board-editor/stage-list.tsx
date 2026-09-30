"use client";

import { STAGE_COLORS } from "@domain";
import { ArrowDown, ArrowUp, ChevronDown, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { RuleEditor } from "@/components/board-editor/rule-editor";
import { useConfirm } from "@/components/sheet";
import { StagePill, inputClass, secondaryButton, stageStyle } from "@/components/ui";
import type { BoardDraft } from "@/lib/board-editor";
import { t } from "@/lib/i18n";
import type { FieldDef } from "@/lib/queries";

// S21 on a phone: the stages as a list. Each row opens to rename, recolor, reorder, mark as
// first or last, pick required fields, and set the arrows out of it with a simple rule.
export function StageList({
  draft,
  defs,
  cardsIn,
}: {
  draft: BoardDraft;
  defs: FieldDef[];
  cardsIn: (stageKey: string) => number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const { graph } = draft;

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {graph.stages.map((s, i) => (
          <li key={s.key} className="rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-2 p-2">
              <button
                type="button"
                aria-expanded={open === s.key}
                onClick={() => setOpen(open === s.key ? null : s.key)}
                className="flex min-h-touch flex-1 items-center gap-2 text-left"
              >
                <StagePill name={s.name} color={s.color} />
                {graph.entry === s.key && (
                  <span className="text-caption text-muted-foreground">{t("editor.first")}</span>
                )}
                {graph.terminal.includes(s.key) && (
                  <span className="text-caption text-muted-foreground">{t("editor.last")}</span>
                )}
                {s.onEnter.length > 0 && (
                  <span className="flex items-center text-caption text-muted-foreground">
                    <Zap aria-hidden size={12} />
                    {s.onEnter.length}
                  </span>
                )}
                <ChevronDown
                  aria-hidden
                  size={16}
                  className={`ml-auto transition-transform ${open === s.key ? "rotate-180" : ""}`}
                />
              </button>
              <button
                type="button"
                aria-label={t("editor.moveUp")}
                disabled={i === 0}
                onClick={() => draft.moveStage(s.key, -1)}
                className="min-h-touch min-w-touch disabled:opacity-30"
              >
                <ArrowUp aria-hidden size={18} className="mx-auto" />
              </button>
              <button
                type="button"
                aria-label={t("editor.moveDown")}
                disabled={i === graph.stages.length - 1}
                onClick={() => draft.moveStage(s.key, 1)}
                className="min-h-touch min-w-touch disabled:opacity-30"
              >
                <ArrowDown aria-hidden size={18} className="mx-auto" />
              </button>
            </div>
            {open === s.key && (
              <StageSettings stageKey={s.key} draft={draft} defs={defs} cards={cardsIn(s.key)} />
            )}
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          setOpen(draft.addStage(newName));
          setNewName("");
        }}
      >
        <input
          aria-label={t("editor.newStage")}
          placeholder={t("editor.newStage")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={!newName.trim()} className={secondaryButton}>
          + {t("editor.add")}
        </button>
      </form>
    </div>
  );
}

export function StageSettings({
  stageKey,
  draft,
  defs,
  cards,
}: {
  stageKey: string;
  draft: BoardDraft;
  defs: FieldDef[];
  cards: number;
}) {
  const { graph } = draft;
  const { ask, dialog } = useConfirm();
  const s = graph.stages.find((x) => x.key === stageKey);
  if (!s) return null;
  const nameOf = (k: string) => graph.stages.find((x) => x.key === k)?.name ?? k;
  const out = graph.transitions.filter((x) => x.from === s.key);
  const targets = graph.stages.filter((x) => x.key !== s.key && !out.some((o) => o.to === x.key));

  return (
    <div className="flex flex-col gap-4 border-t border-border p-3">
      <label className="flex flex-col gap-1 text-label font-medium">
        {t("editor.name")}
        <input
          value={s.name}
          maxLength={40}
          onChange={(e) => draft.setStage(s.key, { name: e.target.value })}
          className={inputClass}
        />
      </label>

      <div role="radiogroup" aria-label={t("editor.color")} className="flex flex-wrap gap-2">
        {STAGE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={s.color === c}
            aria-label={c}
            onClick={() => draft.setStage(s.key, { color: c })}
            className={`size-touch rounded-full border-2 ${s.color === c ? "border-foreground" : "border-transparent"}`}
            style={stageStyle(c)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-label">
        <label className="flex min-h-touch items-center gap-2">
          <input
            type="radio"
            checked={graph.entry === s.key}
            onChange={() => draft.setEntry(s.key)}
            className="size-5 accent-[var(--primary)]"
          />
          {t("editor.isFirst")}
        </label>
        <label className="flex min-h-touch items-center gap-2">
          <input
            type="checkbox"
            checked={graph.terminal.includes(s.key)}
            onChange={(e) => draft.setTerminal(s.key, e.target.checked)}
            className="size-5 accent-[var(--primary)]"
          />
          {t("editor.isLast")}
        </label>
      </div>

      {defs.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-label font-medium">{t("editor.required")}</legend>
          {defs.map((d) => (
            <label key={d.key} className="flex min-h-touch items-center gap-2">
              <input
                type="checkbox"
                checked={s.require.includes(d.key)}
                onChange={(e) =>
                  draft.setStage(s.key, {
                    require: e.target.checked
                      ? [...s.require, d.key]
                      : s.require.filter((k) => k !== d.key),
                  })
                }
                className="size-5 accent-[var(--primary)]"
              />
              {d.label}
            </label>
          ))}
        </fieldset>
      )}

      {s.onEnter.length > 0 && (
        <p className="flex items-center gap-1 text-label text-muted-foreground">
          <Zap aria-hidden size={14} />
          {t("editor.actions").replace("{n}", String(s.onEnter.length))}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-label font-medium">{t("editor.arrows")}</span>
        {out.map((a) => (
          <div key={a.to} className="flex flex-col gap-2 rounded-md border border-border p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">→ {nameOf(a.to)}</span>
              <button
                type="button"
                aria-label={t("editor.removeArrow")}
                onClick={() => draft.removeArrow(s.key, a.to)}
                className="min-h-touch min-w-touch text-danger"
              >
                <Trash2 aria-hidden size={16} className="mx-auto" />
              </button>
            </div>
            <RuleEditor
              when={a.when}
              defs={defs}
              onChange={(when) => draft.setArrow(s.key, a.to, { when })}
            />
          </div>
        ))}
        {targets.length > 0 && (
          <select
            aria-label={t("editor.addArrow")}
            value=""
            onChange={(e) => e.target.value && draft.addArrow(s.key, e.target.value)}
            className={inputClass}
          >
            <option value="">+ {t("editor.addArrow")}</option>
            {targets.map((x) => (
              <option key={x.key} value={x.key}>
                {x.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        type="button"
        disabled={graph.stages.length === 1}
        onClick={() => {
          const msg = cards
            ? t("editor.removeWithCards").replace("{n}", String(cards))
            : t("editor.removeConfirm");
          void ask({
            title: t("editor.removeStage"),
            message: msg,
            confirmLabel: t("editor.removeStage"),
          }).then((ok) => ok && draft.removeStage(s.key));
        }}
        className="flex min-h-touch items-center gap-2 self-start text-label text-danger"
      >
        <Trash2 aria-hidden size={16} /> {t("editor.removeStage")}
      </button>
      {dialog}
    </div>
  );
}
