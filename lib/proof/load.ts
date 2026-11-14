import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { getAnonId } from "../anon";
import { getAttempt } from "../attempts";
import { getDb } from "../db";
import { events, feedback, type Attempt } from "../db/schema";
import type { DrillScore } from "../drill/types";
import type { Score } from "../grading/types";
import type { LoggedEvent } from "../integrity";

/** One DB read per request, shared by generateMetadata, the page and the OG image. */
export const getProofAttempt = cache(getAttempt);

export type ProofAccess =
  | { kind: "not_found" }
  /** The owner's own attempt that has no score yet. */
  | { kind: "pending"; attempt: Attempt }
  | { kind: "graded"; attempt: Attempt; score: Score; isOwner: boolean; anonId: string | null }
  /** A completed daily drill: public, with its own layout. */
  | { kind: "drill"; attempt: Attempt; score: DrillScore; isOwner: boolean };

/**
 * Who may see what. A graded proof is public. Anything else exists only for
 * its owner; to everyone else it is a 404, so an attempt id cannot be probed.
 */
export async function loadProof(attemptId: string): Promise<ProofAccess> {
  const [attempt, anonId] = await Promise.all([getProofAttempt(attemptId), getAnonId()]);
  if (!attempt) return { kind: "not_found" };
  const isOwner = anonId !== null && attempt.anonId === anonId;
  if (attempt.kind === "drill") {
    if (attempt.status === "graded" && attempt.score) {
      return { kind: "drill", attempt, score: attempt.score as DrillScore, isOwner };
    }
    return isOwner ? { kind: "pending", attempt } : { kind: "not_found" };
  }
  if (attempt.status === "graded" && attempt.score) {
    return { kind: "graded", attempt, score: attempt.score as Score, isOwner, anonId };
  }
  return isOwner ? { kind: "pending", attempt } : { kind: "not_found" };
}

export async function loadEvents(attemptId: string): Promise<LoggedEvent[]> {
  return getDb()
    .select({ type: events.type, ts: events.ts, payload: events.payload })
    .from(events)
    .where(eq(events.attemptId, attemptId))
    .orderBy(asc(events.id));
}

export type EmployerVerdict = "would_interview" | "not_yet";

/** The verdict this visitor already left on this proof, if any. */
export async function existingVerdict(attemptId: string, anonId: string | null): Promise<EmployerVerdict | null> {
  if (!anonId) return null;
  const [row] = await getDb()
    .select({ value: feedback.value })
    .from(feedback)
    .where(and(eq(feedback.attemptId, attemptId), eq(feedback.source, "employer"), eq(feedback.anonId, anonId)))
    .limit(1);
  return ((row?.value as { verdict?: EmployerVerdict } | null)?.verdict as EmployerVerdict | undefined) ?? null;
}
