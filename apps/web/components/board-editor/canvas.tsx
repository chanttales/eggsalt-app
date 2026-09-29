"use client";

import type { BoardGraph } from "@domain";
import { Plus, Trash2 } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { RuleEditor, ruleText } from "@/components/board-editor/rule-editor";
import { StageSettings } from "@/components/board-editor/stage-list";
import { inputClass, secondaryButton, stageStyle } from "@/components/ui";
import type { BoardDraft } from "@/lib/board-editor";
import { t } from "@/lib/i18n";
import type { FieldDef } from "@/lib/queries";

const W = 150;
const H = 52;
const GAP_X = 70;
const GAP_Y = 36;

type Point = [number, number];
type Selection = { stage: string } | { from: string; to: string } | null;

/** Where each stage sits: its saved position, or columns by distance from the first stage. */
function layout(graph: BoardGraph): Map<string, Point> {
  const depth = new Map<string, number>([[graph.entry, 0]]);
  const queue = [graph.entry];
  while (queue.length) {
    const from = queue.shift() as string;
    for (const tr of graph.transitions.filter((x) => x.from === from)) {
      if (!depth.has(tr.to)) {
        depth.set(tr.to, (depth.get(from) ?? 0) + 1);
        queue.push(tr.to);
      }
    }
  }
  const rows = new Map<number, number>();
  const at = new Map<string, Point>();
  for (const s of graph.stages) {
    if (s.pos) {
      at.set(s.key, s.pos);
      continue;
    }
    const col = depth.get(s.key) ?? Math.max(0, ...depth.values()) + 1;
    const row = rows.get(col) ?? 0;
    rows.set(col, row + 1);
    at.set(s.key, [24 + col * (W + GAP_X), 24 + row * (H + GAP_Y)]);
  }
  return at;
}

function arrowPath([x1, y1]: Point, [x2, y2]: Point): string {
  const a: Point = [x1 + W, y1 + H / 2];
  const b: Point = [x2, y2 + H / 2];
  const bend = Math.max(40, Math.abs(b[0] - a[0]) / 2);
  return `M${a[0]},${a[1]} C${a[0] + bend},${a[1]} ${b[0] - bend},${b[1]} ${b[0]},${b[1]}`;
}

// S21 on the web: stages as boxes on a canvas. Drag a box to move it, drag from its right dot to
// another box to draw an arrow, click a box or an arrow to edit it below.
export function BoardCanvas({
  draft,
  defs,
  cardsIn,
}: {
  draft: BoardDraft;
  defs: FieldDef[];
  cardsIn: (stageKey: string) => number;
}) {
  const { graph } = draft;
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [drag, setDrag] = useState<{ key: string; offset: Point; at: Point } | null>(null);
  const [wire, setWire] = useState<{ from: string; to: Point } | null>(null);
  const [newName, setNewName] = useState("");

  const pos = layout(graph);
  if (drag) pos.set(drag.key, drag.at);
  const width = Math.max(640, ...[...pos.values()].map(([x]) => x + W + 40));
  const height = Math.max(320, ...[...pos.values()].map(([, y]) => y + H + 40));

  const point = (e: PointerEvent): Point => {
    const box = ref.current?.getBoundingClientRect();
    return [e.clientX - (box?.left ?? 0), e.clientY - (box?.top ?? 0)];
  };
  const stageAt = ([x, y]: Point) =>
    graph.stages.find((s) => {
      const [sx, sy] = pos.get(s.key) ?? [0, 0];
      return x >= sx && x <= sx + W && y >= sy && y <= sy + H;
    })?.key;

  function onMove(e: PointerEvent) {
    const p = point(e);
    if (drag) setDrag({ ...drag, at: [p[0] - drag.offset[0], p[1] - drag.offset[1]] });
    if (wire) setWire({ ...wire, to: p });
  }
  function onUp(e: PointerEvent) {
    if (drag) {
      const [x, y] = drag.at;
      const [x0, y0] = layout(graph).get(drag.key) ?? [x, y];
      // A click without movement only selects; it shouldn't pin the box or dirty the draft.
      if (Math.abs(x - x0) + Math.abs(y - y0) > 3) {
        draft.setStage(drag.key, { pos: [Math.max(0, Math.round(x)), Math.max(0, Math.round(y))] });
      }
      setDrag(null);
    }
    if (wire) {
      const target = stageAt(point(e));
      if (target && target !== wire.from) {
        draft.addArrow(wire.from, target);
        setSelected({ from: wire.from, to: target });
      }
      setWire(null);
    }
  }

  const arrow =
    selected && "from" in selected
      ? graph.transitions.find((x) => x.from === selected.from && x.to === selected.to)
      : undefined;
  const nameOf = (k: string) => graph.stages.find((s) => s.key === k)?.name ?? k;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-auto rounded-lg border border-border bg-surface-muted">
        <div
          ref={ref}
          className="relative touch-none select-none"
          style={{ width, height }}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <svg width={width} height={height} className="absolute inset-0" aria-hidden>
            <defs>
              <marker
                id="arrowhead"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
              </marker>
            </defs>
            {graph.transitions.map((tr) => {
              const a = pos.get(tr.from);
              const b = pos.get(tr.to);
              if (!a || !b) return null;
              const active =
                selected &&
                "from" in selected &&
                selected.from === tr.from &&
                selected.to === tr.to;
              const d = arrowPath(a, b);
              return (
                <g
                  key={`${tr.from}>${tr.to}`}
                  className={active ? "text-primary" : "text-muted-foreground"}
                >
                  <path
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={active ? 3 : 2}
                    markerEnd="url(#arrowhead)"
                    strokeDasharray={tr.when ? "6 4" : undefined}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => setSelected({ from: tr.from, to: tr.to })}
                  />
                </g>
              );
            })}
            {wire && pos.get(wire.from) && (
              <line
                x1={(pos.get(wire.from) as Point)[0] + W}
                y1={(pos.get(wire.from) as Point)[1] + H / 2}
                x2={wire.to[0]}
                y2={wire.to[1]}
                stroke="var(--primary)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}
          </svg>

          {graph.stages.map((s) => {
            const [x, y] = pos.get(s.key) ?? [0, 0];
            const active = selected && "stage" in selected && selected.stage === s.key;
            return (
              <div
                key={s.key}
                className={`absolute flex cursor-grab items-center justify-center rounded-lg px-3 text-center text-label font-semibold shadow-sm ${
                  active ? "ring-2 ring-primary" : ""
                } ${graph.terminal.includes(s.key) ? "border-2 border-current" : ""}`}
                style={{ left: x, top: y, width: W, height: H, ...stageStyle(s.color) }}
                onPointerDown={(e) => {
                  const p = point(e);
                  setDrag({ key: s.key, offset: [p[0] - x, p[1] - y], at: [x, y] });
                  setSelected({ stage: s.key });
                }}
              >
                {graph.entry === s.key && (
                  <span className="absolute -top-5 left-0 text-caption text-muted-foreground">
                    {t("editor.first")}
                  </span>
                )}
                <span className="line-clamp-2">{s.name}</span>
                <button
                  type="button"
                  aria-label={`${t("editor.addArrow")}: ${s.name}`}
                  className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-surface bg-primary"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setWire({ from: s.key, to: point(e) });
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          setSelected({ stage: draft.addStage(newName) });
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
          <Plus aria-hidden size={16} /> {t("editor.add")}
        </button>
      </form>

      {selected && "stage" in selected && (
        <div className="rounded-lg border border-border bg-surface">
          <StageSettings
            stageKey={selected.stage}
            draft={draft}
            defs={defs}
            cards={cardsIn(selected.stage)}
          />
        </div>
      )}
      {arrow && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">
              {nameOf(arrow.from)} → {nameOf(arrow.to)}
            </span>
            <button
              type="button"
              aria-label={t("editor.removeArrow")}
              onClick={() => {
                draft.removeArrow(arrow.from, arrow.to);
                setSelected(null);
              }}
              className="min-h-touch min-w-touch text-danger"
            >
              <Trash2 aria-hidden size={16} className="mx-auto" />
            </button>
          </div>
          <label className="flex flex-col gap-1 text-label font-medium">
            {t("editor.arrowLabel")}
            <input
              value={arrow.label ?? ""}
              maxLength={40}
              onChange={(e) => draft.setArrow(arrow.from, arrow.to, { label: e.target.value })}
              className={inputClass}
            />
          </label>
          {arrow.when && (
            <p className="text-caption text-muted-foreground">{ruleText(arrow.when, defs)}</p>
          )}
          <RuleEditor
            when={arrow.when}
            defs={defs}
            onChange={(when) => draft.setArrow(arrow.from, arrow.to, { when })}
          />
        </div>
      )}
    </div>
  );
}
