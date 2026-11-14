import { getAnonId } from "@/lib/anon";
import { jsonError, readJson } from "@/lib/api";
import { getAttempt } from "@/lib/attempts";
import { submitDrill } from "@/lib/drill/attempts";
import { drillSubmitSchema } from "@/lib/drill/score";

/**
 * Submit a drill. The body carries only picks and timings; the score is
 * computed here from the server's copy of the items. Owner only. A late
 * submit is accepted and its overtime recorded.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = drillSubmitSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("invalid_input", "That drill submission is not valid. Reload and try again.");
  const { attemptId, answers } = parsed.data;

  const anonId = await getAnonId();
  const attempt = await getAttempt(attemptId);
  if (!attempt || attempt.kind !== "drill" || !anonId || attempt.anonId !== anonId) {
    return jsonError("not_found", "This drill does not exist.");
  }

  const redirectTo = `/drill/${attempt.id}`;
  // Already submitted (double click, second tab): the first submit stands.
  if (attempt.status === "active") await submitDrill(attempt, answers);
  return Response.json({ ok: true, redirectTo }, { headers: { "Cache-Control": "no-store" } });
}
