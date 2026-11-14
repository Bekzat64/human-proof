import type { DrillScore } from "./drill/types";
import { DRILL_REASONS, type DrillReason } from "./drill/types";
import { DIMENSIONS, type Dimension, type Score, type TrapOutcome } from "./grading/types";

/** Public /stats, computed from real rows only. Pure: the page loads and filters, this aggregates. */

/** Our own testing identities: `qa-…` ids, plus browser cookies listed in QA_ANON_IDS (comma-separated). */
export function isQaAnon(anonId: string | null, extra: ReadonlySet<string>): boolean {
  return !anonId || anonId.startsWith("qa-") || extra.has(anonId);
}

export function qaAnonIdsFromEnv(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

export type PublicStats = {
  sims: {
    n: number;
    /** Sims where at least one AI error was shown. Base for the "missed" share. */
    withExposed: number;
    missedAtLeastOne: number;
    /** Trap with the highest miss rate among sims where it was shown. */
    mostMissed: { id: string; missed: number; shown: number } | null;
    /** Average share of each dimension's points (0–1), over sims where it was assessed. */
    dimensions: Record<Dimension, { avg: number | null; n: number }>;
    averageTotal: number | null;
  };
  drills: { n: number; byReason: Record<DrillReason, { seen: number; spotted: number }> };
  employer: { n: number; wouldInterview: number };
};

const MISSED: TrapOutcome = "missed";

export function computeStats(input: {
  sims: Score[];
  drills: DrillScore[];
  verdicts: ("would_interview" | "not_yet")[];
}): PublicStats {
  const { sims, drills, verdicts } = input;

  const withExposed = sims.filter((s) => s.traps.some((t) => t.exposed));
  const missedAtLeastOne = withExposed.filter((s) => s.traps.some((t) => t.outcome === MISSED)).length;

  const perTrap = new Map<string, { missed: number; shown: number }>();
  for (const s of sims) {
    for (const t of s.traps) {
      if (!t.exposed) continue;
      const entry = perTrap.get(t.id) ?? { missed: 0, shown: 0 };
      entry.shown++;
      if (t.outcome === MISSED) entry.missed++;
      perTrap.set(t.id, entry);
    }
  }
  const mostMissed =
    [...perTrap.entries()]
      .filter(([, v]) => v.missed > 0)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.missed / b.shown - a.missed / a.shown || b.missed - a.missed)[0] ?? null;

  const dimensions = Object.fromEntries(
    DIMENSIONS.map((d) => {
      const ratios = sims
        .map((s) => s.dimensions[d])
        .filter((x) => x.max > 0)
        .map((x) => x.score / x.max);
      return [d, { n: ratios.length, avg: ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null }];
    }),
  ) as PublicStats["sims"]["dimensions"];

  const byReason = Object.fromEntries(DRILL_REASONS.map((r) => [r, { seen: 0, spotted: 0 }])) as PublicStats["drills"]["byReason"];
  for (const d of drills) {
    for (const item of d.items) {
      byReason[item.truthReason].seen++;
      if (item.sentenceCorrect) byReason[item.truthReason].spotted++;
    }
  }

  return {
    sims: {
      n: sims.length,
      withExposed: withExposed.length,
      missedAtLeastOne,
      mostMissed,
      dimensions,
      averageTotal: sims.length ? sims.reduce((a, s) => a + s.total, 0) / sims.length : null,
    },
    drills: { n: drills.length, byReason },
    employer: { n: verdicts.length, wouldInterview: verdicts.filter((v) => v === "would_interview").length },
  };
}
