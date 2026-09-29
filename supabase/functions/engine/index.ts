// Engine: the only writer of cards, stock and money. See docs/design/06-technical-architecture.md.

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { handle } from "./handler.ts";
import { ops } from "./ops.ts";

const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
}).auth;

// The pooler runs in transaction mode, which doesn't support prepared statements.
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });

async function verifyToken(token: string): Promise<string | null> {
  const { data, error } = await auth.getClaims(token);
  return error || !data?.claims.sub ? null : data.claims.sub;
}

Deno.serve((req) => handle(req, { sql, verifyToken, ops }));
