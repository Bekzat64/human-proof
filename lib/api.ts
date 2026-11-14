/** The one error shape every API route returns. */
export type ApiError = {
  error: { code: ApiErrorCode; message: string };
};

export type ApiErrorCode =
  | "invalid_input"
  | "no_identity"
  | "not_found"
  | "not_active"
  | "own_attempt"
  | "already_recorded"
  | "message_limit"
  | "copilot_unavailable";

const STATUS: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  no_identity: 401,
  not_found: 404,
  not_active: 409,
  own_attempt: 403,
  already_recorded: 409,
  message_limit: 429,
  copilot_unavailable: 503,
};

export function jsonError(code: ApiErrorCode, message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status: STATUS[code], headers: { "Cache-Control": "no-store" } });
}

/** Parse a request body as JSON; `undefined` if it is not valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Best-effort extraction of a friendly message from a failed fetch Response. */
export async function errorMessageFrom(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as Partial<ApiError>;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}
