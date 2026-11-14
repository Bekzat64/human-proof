import "server-only";
import { and, count, eq, gt } from "drizzle-orm";
import { getDb } from "./db";
import { attempts } from "./db/schema";

/**
 * Per-visitor rate limits (PLAN §14), counted from the attempts table, so
 * they hold across serverless instances with no extra store. The 30-message
 * copilot limit per attempt lives in the copilot route.
 */
export const LIMITS = {
  simsPerHour: 5,
  drillsPerHour: 10,
  submitsPerHour: 20,
} as const;

const HOUR_MS = 60 * 60 * 1000;
const hourAgo = () => new Date(Date.now() - HOUR_MS);

export type LimitCheck = { ok: true } | { ok: false; message: string };

async function startedInLastHour(anonId: string, kind: "sim" | "drill"): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(attempts)
    .where(and(eq(attempts.anonId, anonId), eq(attempts.kind, kind), gt(attempts.startedAt, hourAgo())));
  return row.n;
}

export async function checkNewSim(anonId: string): Promise<LimitCheck> {
  return (await startedInLastHour(anonId, "sim")) < LIMITS.simsPerHour
    ? { ok: true }
    : {
        ok: false,
        message: `You have started ${LIMITS.simsPerHour} simulations in the last hour, which is the limit. Take a break and try again later; your proofs are safe on My proofs.`,
      };
}

export async function checkNewDrill(anonId: string): Promise<LimitCheck> {
  return (await startedInLastHour(anonId, "drill")) < LIMITS.drillsPerHour
    ? { ok: true }
    : {
        ok: false,
        message: `That is ${LIMITS.drillsPerHour} drills in the last hour, the limit for now. Come back in a bit; only the first drill of the day counts toward your streak anyway.`,
      };
}

/** Simulations and drills together: closing an attempt more than 20 times an hour is not a person practising. */
export async function checkSubmit(anonId: string): Promise<LimitCheck> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(attempts)
    .where(and(eq(attempts.anonId, anonId), gt(attempts.submittedAt, hourAgo())));
  return row.n < LIMITS.submitsPerHour
    ? { ok: true }
    : {
        ok: false,
        message: `You have submitted ${LIMITS.submitsPerHour} times in the last hour, which is the limit. Your answers are still here: try again in a little while.`,
      };
}
