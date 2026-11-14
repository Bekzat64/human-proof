import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../db";
import { attempts, events, type Attempt } from "../db/schema";
import { dailyDrill, dateFromScenarioId, drillDateKey, previousDateKey, scenarioIdForDate, seedFromDate } from "./daily";
import { computeStreak, scoreDrill } from "./score";
import { DRILL_DURATION_MS, isDrillExpired, type DrillAnswer, type DrillScore } from "./types";

/** Start today's drill for this visitor. The clock starts now. */
export async function createDrillAttempt(anonId: string): Promise<string> {
  const id = nanoid(12);
  const date = drillDateKey(new Date());
  await getDb()
    .insert(attempts)
    .values({
      id,
      anonId,
      kind: "drill",
      scenarioId: scenarioIdForDate(date),
      seed: seedFromDate(date) & 0x7fffffff, // attempts.seed is a Postgres integer
    });
  return id;
}

/** New York dates on which this visitor completed a drill that counts (on time, first of its day). */
export async function completedDrillDates(anonId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ scenarioId: attempts.scenarioId })
    .from(attempts)
    .where(
      and(
        eq(attempts.anonId, anonId),
        eq(attempts.kind, "drill"),
        eq(attempts.status, "graded"),
        sql`${attempts.score} ->> 'countsForStreak' = 'true'`,
      ),
    );
  return rows.map((row) => dateFromScenarioId(row.scenarioId));
}

export async function currentStreak(anonId: string): Promise<number> {
  return computeStreak(await completedDrillDates(anonId), drillDateKey(new Date()), previousDateKey);
}

export function drillRemainingMs(attempt: Pick<Attempt, "startedAt">): number {
  return attempt.startedAt.getTime() + DRILL_DURATION_MS - Date.now();
}

/**
 * Score and close a drill: active → graded, in one guarded write, so a double
 * submit is harmless (the first one stands). Scoring happens here, against
 * the server's copy of the day's items; the browser never had the answers.
 */
export async function submitDrill(attempt: Attempt, answers: DrillAnswer[]): Promise<DrillScore | null> {
  const db = getDb();
  const submittedAt = new Date();
  const date = dateFromScenarioId(attempt.scenarioId);
  const items = dailyDrill(date);

  // Only the first completed drill of a day counts toward the streak, and
  // only if it came in on time (the server's clock, with a short grace for
  // the request itself). A late drill is still scored, as practice.
  const elapsedMs = submittedAt.getTime() - attempt.startedAt.getTime();
  const earlier = await completedDrillDates(attempt.anonId);
  const onTime = !isDrillExpired(attempt.startedAt, submittedAt.getTime());
  const countsForStreak = onTime && !earlier.includes(date);
  // The streak "as of this drill" runs back from the drill's own day.
  const streak = computeStreak([...earlier, date], date, previousDateKey);

  const score = scoreDrill({
    date,
    items,
    answers,
    elapsedMs,
    countsForStreak,
    streak,
  });

  const closed = await db
    .update(attempts)
    .set({ answer: answers, score, total: score.total, status: "graded", submittedAt })
    .where(and(eq(attempts.id, attempt.id), eq(attempts.status, "active")))
    .returning({ id: attempts.id });
  if (closed.length === 0) return null;

  const known = new Set(items.map((item) => item.id));
  await db.insert(events).values([
    ...answers
      .filter((a) => known.has(a.itemId))
      .map((a) => ({ attemptId: attempt.id, type: "drill_answer" as const, ts: submittedAt, payload: a })),
    {
      attemptId: attempt.id,
      type: "submit" as const,
      ts: submittedAt,
      payload: { elapsedSec: score.elapsedSec, overtimeSec: score.overtimeSec },
    },
  ]);
  return score;
}
