import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { answerSchema } from "../answers";
import { getDb } from "../db";
import { attempts, events, type Attempt } from "../db/schema";
import { isLlmAvailable } from "../llm";
import { buildVariant } from "../variant";
import { llmRubric } from "./llm";
import { scoreAttempt, type ScoringInput } from "./score";
import type { Score } from "./types";

/** Everything scoring needs for one attempt, or null if it has no valid answer. */
export async function loadScoringInput(attempt: Attempt): Promise<ScoringInput | null> {
  const answer = answerSchema.safeParse(attempt.answer);
  if (!answer.success) return null;
  const log = await getDb()
    .select({ type: events.type, ts: events.ts, payload: events.payload })
    .from(events)
    .where(eq(events.attemptId, attempt.id))
    .orderBy(asc(events.id));
  return { variant: buildVariant(attempt.seed), answer: answer.data, events: log };
}

/**
 * Grade a submitted attempt: submitted → graded.
 *
 * Idempotent. An attempt that is already graded is returned untouched, and
 * the write is guarded by `status = 'submitted'`, so two graders racing on
 * the same attempt cannot overwrite each other.
 */
export async function gradeAttempt(attemptId: string): Promise<Score | null> {
  const db = getDb();
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1);
  if (!attempt) return null;
  if (attempt.status === "graded") return attempt.score as Score;
  if (attempt.status !== "submitted") return null;

  const input = await loadScoringInput(attempt);
  if (!input) return null;

  const rubric = isLlmAvailable() ? await llmRubric(input.variant, input.answer) : null;
  const score = scoreAttempt(input, rubric);

  const written = await db
    .update(attempts)
    .set({ score, total: score.total, status: "graded" })
    .where(and(eq(attempts.id, attempt.id), eq(attempts.status, "submitted")))
    .returning({ id: attempts.id });
  if (written.length > 0) return score;

  // Someone else graded it first: theirs stands.
  const [current] = await db.select({ score: attempts.score }).from(attempts).where(eq(attempts.id, attemptId));
  return (current?.score as Score | undefined) ?? null;
}
