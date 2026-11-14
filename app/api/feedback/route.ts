import { getAnonId } from "@/lib/anon";
import { jsonError, readJson } from "@/lib/api";
import { getAttempt } from "@/lib/attempts";
import { getDb } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { feedbackSchema } from "@/lib/feedback-schema";

/**
 * An employer's verdict on a proof: "would interview" or "not yet", with an
 * optional note. One per visitor per proof (enforced by a unique index, so a
 * double click or a replayed request cannot add a second row), and never from
 * the proof's own owner.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = feedbackSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError("invalid_input", "Send a verdict (would_interview or not_yet) and an optional note of up to 500 characters.");
  }
  const { attemptId, verdict, note } = parsed.data;

  const anonId = await getAnonId();
  if (!anonId) return jsonError("no_identity", "Cookies are needed to record your answer. Enable them and reload.");

  const attempt = await getAttempt(attemptId);
  if (!attempt || attempt.kind !== "sim" || attempt.status !== "graded") {
    return jsonError("not_found", "This proof does not exist.");
  }
  if (attempt.anonId === anonId) {
    return jsonError("own_attempt", "You cannot leave employer feedback on your own proof.");
  }

  const inserted = await getDb()
    .insert(feedback)
    .values({
      attemptId: attempt.id,
      source: "employer",
      anonId,
      kind: "interview_verdict",
      value: { verdict, ...(note ? { note } : {}) },
    })
    .onConflictDoNothing()
    .returning({ id: feedback.id });

  if (inserted.length === 0) {
    return jsonError("already_recorded", "Your answer for this proof was already recorded.");
  }
  return Response.json({ ok: true, verdict }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
