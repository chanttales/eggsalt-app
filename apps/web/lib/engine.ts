import { supabase } from "@/lib/supabase";

// Calls the engine Edge Function: the only way the app changes cards, stock and money.
const ENGINE_URL =
  process.env.NEXT_PUBLIC_ENGINE_URL ||
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/functions/v1/engine`;

export type EngineErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "conflict"
  | "unknown_op"
  | "not_implemented"
  | "internal"
  | "network";

export class EngineRequestError extends Error {
  code: EngineErrorCode;
  status: number;
  constructor(code: EngineErrorCode, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
  /** Worth sending again later: no signal, a server hiccup, or a session that needs refreshing. */
  get retryable(): boolean {
    return this.code === "network" || this.code === "unauthorized" || this.status >= 500;
  }
}

export async function callEngine<T = unknown>(
  op: string,
  workspaceId: string,
  input: unknown,
): Promise<T> {
  const client = supabase();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new EngineRequestError("unauthorized", 401, "Not signed in");

  let res: Response;
  try {
    res = await fetch(ENGINE_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        "content-type": "application/json",
      },
      body: JSON.stringify({ op, workspaceId, input }),
    });
  } catch {
    throw new EngineRequestError("network", 0, "No connection");
  }
  const body = (await res.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; error: { code: EngineErrorCode; message: string } }
    | null;
  if (body?.ok) return body.result;
  const code =
    body?.ok === false ? body.error.code : res.status >= 500 ? "internal" : "bad_request";
  throw new EngineRequestError(
    code,
    res.status,
    body?.ok === false ? body.error.message : res.statusText,
  );
}
