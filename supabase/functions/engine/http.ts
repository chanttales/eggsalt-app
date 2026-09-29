// JSON responses and CORS. Callers are the static web app (GitHub Pages) and the Android app
// (capacitor://localhost); every request carries a bearer token and no cookies, so any origin is
// allowed and the token does the protecting.

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "conflict"
  | "unknown_op"
  | "not_implemented"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  unknown_op: 400,
  not_implemented: 501,
  internal: 500,
};

/** An expected failure with a stable code the app can translate. */
export class EngineError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function ok(result: unknown): Response {
  return Response.json({ ok: true, result }, { headers: CORS_HEADERS });
}

export function fail(code: ErrorCode, message: string): Response {
  return Response.json(
    { ok: false, error: { code, message } },
    { status: STATUS[code], headers: CORS_HEADERS },
  );
}
