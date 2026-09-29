"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export interface Workspace {
  id: string;
  name: string;
  role: "owner" | "staff";
}

export type SessionState =
  | { status: "unconfigured" | "loading" | "signed_out" | "error" }
  | {
      status: "signed_in";
      session: Session;
      workspaces: Workspace[];
      /** The workspace the app shows; null until the user has one. */
      workspace: Workspace | null;
    };

interface SessionContext {
  state: SessionState;
  selectWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Context = createContext<SessionContext | null>(null);
const ACTIVE_KEY = "papan.workspace";

function readActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActive(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Storage can be blocked (private mode); the first workspace is used instead.
  }
}

async function loadWorkspaces(userId: string): Promise<Workspace[]> {
  const { data, error } = await supabase()
    .from("member")
    .select("role, workspace:workspace_id (id, name)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const ws = row.workspace as unknown as { id: string; name: string } | null;
    return ws ? [{ id: ws.id, name: ws.name, role: row.role as Workspace["role"] }] : [];
  });
}

function pick(workspaces: Workspace[], preferred: string | null): Workspace | null {
  return workspaces.find((w) => w.id === preferred) ?? workspaces[0] ?? null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    status: supabaseConfigured ? "loading" : "unconfigured",
  });

  const apply = useCallback(async (session: Session | null) => {
    if (!session) {
      setState({ status: "signed_out" });
      return;
    }
    try {
      const workspaces = await loadWorkspaces(session.user.id);
      const workspace = pick(workspaces, readActive());
      setState({ status: "signed_in", session, workspaces, workspace });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const auth = supabase().auth;
    auth.getSession().then(({ data }) => apply(data.session));
    // Supabase calls this inside its own lock; defer the database read until it returns.
    const { data } = auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setTimeout(() => apply(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [apply]);

  const selectWorkspace = useCallback((id: string) => {
    writeActive(id);
    setState((s) => (s.status === "signed_in" ? { ...s, workspace: pick(s.workspaces, id) } : s));
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const { data } = await supabase().auth.getSession();
    await apply(data.session);
  }, [apply]);

  const signOut = useCallback(async () => {
    writeActive(null);
    await supabase().auth.signOut();
  }, []);

  return (
    <Context.Provider value={{ state, selectWorkspace, refreshWorkspaces, signOut }}>
      {children}
    </Context.Provider>
  );
}

export function useSession(): SessionContext {
  const value = useContext(Context);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
