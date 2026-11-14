import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import { attempts } from "./db/schema";

const MIN_ATTEMPTS = 10;

export type Standing =
  | { n: number; earlyPilot: true }
  | { n: number; earlyPilot: false; percentile: number };

/**
 * Where a total stands among real graded simulations of the same scenario.
 * Computed at read time, so it moves as more people take it. Demo attempts
 * never count, and `n` is always reported; below 10 attempts there is no
 * percentile, only "Early pilot".
 */
export async function standingFor(scenarioId: string, total: number): Promise<Standing> {
  const rows = await getDb()
    .select({ total: attempts.total })
    .from(attempts)
    .where(
      and(
        eq(attempts.scenarioId, scenarioId),
        eq(attempts.kind, "sim"),
        eq(attempts.status, "graded"),
        eq(attempts.isDemo, false),
        isNotNull(attempts.total),
      ),
    );
  const n = rows.length;
  if (n < MIN_ATTEMPTS) return { n, earlyPilot: true };
  const below = rows.filter((r) => (r.total ?? 0) < total).length;
  return { n, earlyPilot: false, percentile: Math.round((below / n) * 100) };
}
