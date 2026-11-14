import { getAnonId } from "@/lib/anon";
import { jsonError, readJson } from "@/lib/api";
import { getAttempt } from "@/lib/attempts";
import { checkinSchema } from "@/lib/checkin";
import { getDb } from "@/lib/db";
import { feedback } from "@/lib/db/schema";

/**
 * The candidate's own outcome check-in ("Did you share your proof?", "Got an
 * interview?"), stored as feedback with source 'candidate' against their
 * first proof. Owner only; one answer per question.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = checkinSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("invalid_input", "Send a question (shared_proof or got_interview) and a yes/no answer.");
  const { attemptId, question, answer } = parsed.data;

  const anonId = await getAnonId();
  const attempt = await getAttempt(attemptId);
  if (!attempt || !anonId || attempt.anonId !== anonId || attempt.status !== "graded") {
    return jsonError("not_found", "This proof does not exist.");
  }

  const inserted = await getDb()
    .insert(feedback)
    .values({ attemptId: attempt.id, source: "candidate", anonId, kind: question, value: { answer } })
    .onConflictDoNothing()
    .returning({ id: feedback.id });
  if (inserted.length === 0) return jsonError("already_recorded", "You already answered this one.");
  return Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
