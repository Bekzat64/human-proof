import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { submitSchema } from "@/lib/answers";
import { getAnonId } from "@/lib/anon";
import { jsonError, readJson } from "@/lib/api";
import { getOwnedSimAttempt } from "@/lib/attempts";
import { getDb } from "@/lib/db";
import { attempts, events } from "@/lib/db/schema";
import type { SubmitPayload } from "@/lib/events/schema";
import { gradeAttempt } from "@/lib/grading/compose";
import { SIM_DURATION_MS } from "@/lib/sim-config";

/**
 * Save the candidate's answers and close the attempt: active → submitted.
 * Late submissions are accepted; how far over time they are is recorded.
 * Grading (submitted → graded) is triggered here and runs after the response.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = submitSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError("invalid_input", first?.message ?? "Check your answers and try again.");
  }
  const { attemptId, answer } = parsed.data;

  const attempt = await getOwnedSimAttempt(attemptId, await getAnonId());
  if (!attempt) return jsonError("not_found", "This simulation does not exist.");

  const redirectTo = `/p/${attempt.id}`;
  const ok = () => Response.json({ ok: true, redirectTo }, { headers: { "Cache-Control": "no-store" } });

  const db = getDb();
  const submittedAt = new Date();

  // The status guard makes a double submit harmless: only the first one writes.
  const closed = await db
    .update(attempts)
    .set({ answer, status: "submitted", submittedAt })
    .where(and(eq(attempts.id, attempt.id), eq(attempts.status, "active")))
    .returning({ id: attempts.id });
  if (closed.length === 0) return ok();

  const elapsedMs = submittedAt.getTime() - attempt.startedAt.getTime();
  const payload: SubmitPayload = {
    elapsedSec: Math.round(elapsedMs / 1000),
    overtimeSec: Math.max(0, Math.round((elapsedMs - SIM_DURATION_MS) / 1000)),
  };
  await db.insert(events).values({ attemptId: attempt.id, type: "submit", ts: submittedAt, payload });

  // Grade once the response is on its way. If this is ever cut short, the
  // status endpoint the Proof page polls grades the attempt instead.
  after(() => gradeAttempt(attempt.id).catch((error) => console.error("grading failed", error)));

  return ok();
}
