// Request pipeline: CORS → POST only → bearer token → envelope → transaction as the caller →
// membership check → op. Auth and the database come in as dependencies so the pipeline can be
// exercised against a local Postgres without Supabase Auth.

import type { Sql } from "postgres";
import { z } from "zod";
import { CORS_HEADERS, EngineError, fail, ok } from "./http.ts";
import { type Op, type Role } from "./ops.ts";

export interface Deps {
  sql: Sql;
  /** Verifies the access token and returns the user id, or null when it isn't valid. */
  verifyToken: (token: string) => Promise<string | null>;
  ops: Record<string, Op>;
}

const envelope = z.strictObject({
  op: z.string().min(1),
  workspaceId: z.guid(),
  input: z.unknown().optional(),
});

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST");

  const token = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return fail("unauthorized", "Missing bearer token");
  const userId = await deps.verifyToken(token);
  if (!userId) return fail("unauthorized", "Invalid or expired token");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", "Body must be JSON");
  }
  const parsed = envelope.safeParse(body);
  if (!parsed.success) return fail("bad_request", z.prettifyError(parsed.error));
  const { op: name, workspaceId, input } = parsed.data;
  const op = Object.hasOwn(deps.ops, name) ? deps.ops[name] : undefined;
  if (!op) return fail("unknown_op", `Unknown op ${name}`);

  try {
    const result = await deps.sql.begin(async (tx) => {
      // Run as service_role, so the ledger's append-only grants apply to the engine too, and
      // tell auth.uid() who the caller is, so created_by columns record them.
      await tx`set local role service_role`;
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      const [member] = await tx<{ role: Role }[]>`
        select role from member where workspace_id = ${workspaceId} and user_id = ${userId}`;
      if (!member) throw new EngineError("forbidden", "Not a member of this workspace");
      return op({ tx, userId, workspaceId, role: member.role }, input);
    });
    return ok(result);
  } catch (err) {
    if (err instanceof EngineError) return fail(err.code, err.message);
    console.error(err);
    return fail("internal", "Something went wrong");
  }
}
