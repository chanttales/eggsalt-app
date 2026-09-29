"use client";

import { boardGraph, type BoardGraph, type Condition, type Stage } from "@domain";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Board } from "@/lib/queries";
import { supabase } from "@/lib/supabase";

// The board editor's draft: a copy of the live graph that the owner changes freely. Nothing
// reaches cards until it is published as a new version; cards in progress keep their own version.

export type Compare = Extract<Condition, { op: string }>;

/** A stage key from its name: lowercase, underscores, unique on this board. */
export function stageKey(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^[^a-z]+|_+$/g, "")
      .slice(0, 40) || "tahap";
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
  return key;
}

/** A plain field comparison, the only kind of rule the phone editor builds. */
export function simpleRule(when: Condition | undefined): Compare | null | undefined {
  if (!when) return undefined;
  return "op" in when && "field" in when ? when : null;
}

export function useBoardDraft(board: Board) {
  const [graph, setGraph] = useState<BoardGraph>(() => structuredClone(board.graph));
  const [dirty, setDirty] = useState(false);

  const update = (change: (g: BoardGraph) => void) => {
    setGraph((g) => {
      const next = structuredClone(g);
      change(next);
      return next;
    });
    setDirty(true);
  };
  const stage = (g: BoardGraph, key: string) => g.stages.find((s) => s.key === key);

  const check = boardGraph.safeParse(graph);
  const problems = check.success ? [] : check.error.issues.map((i) => i.message);

  return {
    graph,
    dirty,
    problems,
    reset: () => {
      setGraph(structuredClone(board.graph));
      setDirty(false);
    },
    setStage: (key: string, patch: Partial<Pick<Stage, "name" | "color" | "pos" | "require">>) =>
      update((g) => Object.assign(stage(g, key) ?? {}, patch)),
    moveStage: (key: string, by: -1 | 1) =>
      update((g) => {
        const i = g.stages.findIndex((s) => s.key === key);
        const j = i + by;
        if (i < 0 || j < 0 || j >= g.stages.length) return;
        [g.stages[i], g.stages[j]] = [g.stages[j] as Stage, g.stages[i] as Stage];
      }),
    /** Adds a stage after `after` (or at the end) and returns its key. */
    addStage: (name: string, after?: string) => {
      const key = stageKey(name, new Set(graph.stages.map((s) => s.key)));
      update((g) => {
        const at = after ? g.stages.findIndex((s) => s.key === after) + 1 : g.stages.length;
        g.stages.splice(at || g.stages.length, 0, {
          key,
          name: name.trim(),
          color: "gray",
          onEnter: [],
          require: [],
        });
      });
      return key;
    },
    removeStage: (key: string) =>
      update((g) => {
        g.stages = g.stages.filter((s) => s.key !== key);
        g.transitions = g.transitions.filter((t) => t.from !== key && t.to !== key);
        g.terminal = g.terminal.filter((k) => k !== key);
        if (g.entry === key && g.stages[0]) g.entry = g.stages[0].key;
      }),
    setEntry: (key: string) => update((g) => void (g.entry = key)),
    setTerminal: (key: string, on: boolean) =>
      update((g) => {
        g.terminal = on ? [...new Set([...g.terminal, key])] : g.terminal.filter((k) => k !== key);
      }),
    addArrow: (from: string, to: string) =>
      update((g) => {
        if (from === to || g.transitions.some((t) => t.from === from && t.to === to)) return;
        g.transitions.push({ from, to });
      }),
    removeArrow: (from: string, to: string) =>
      update((g) => {
        g.transitions = g.transitions.filter((t) => !(t.from === from && t.to === to));
      }),
    setArrow: (from: string, to: string, patch: { when?: Condition; label?: string }) =>
      update((g) => {
        const t = g.transitions.find((x) => x.from === from && x.to === to);
        if (!t) return;
        if ("when" in patch) {
          if (patch.when) t.when = patch.when;
          else delete t.when;
        }
        if ("label" in patch) {
          if (patch.label) t.label = patch.label;
          else delete t.label;
        }
      }),
    markSaved: () => setDirty(false),
  };
}

export type BoardDraft = ReturnType<typeof useBoardDraft>;

/** Publishes the draft as the board's next version and retires the one it replaces. */
export function usePublishBoard() {
  const queryClient = useQueryClient();
  return async (board: Board, workspaceId: string, graph: BoardGraph) => {
    const db = supabase();
    const parsed = boardGraph.parse(graph);
    const { data: latest, error: readError } = await db
      .from("board_version")
      .select("version")
      .eq("board_id", board.id)
      .order("version", { ascending: false })
      .limit(1);
    if (readError) throw readError;
    const { data: row, error } = await db
      .from("board_version")
      .insert({
        workspace_id: workspaceId,
        board_id: board.id,
        version: (latest?.[0]?.version ?? 0) + 1,
        status: "published",
        published_at: new Date().toISOString(),
        graph: parsed as never,
      })
      .select("id, version")
      .single();
    if (error) throw error;
    const switched = await db
      .from("board")
      .update({ active_version_id: row.id })
      .eq("id", board.id);
    if (switched.error) throw switched.error;
    await db.from("board_version").update({ status: "retired" }).eq("id", board.versionId);
    await queryClient.invalidateQueries();
    return row.version;
  };
}
