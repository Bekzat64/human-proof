import { DIMENSIONS, type Dimension, type Score } from "./grading/types";
import { DRILL_REASONS, type DrillReason, type DrillScore } from "./drill/types";

/** Progress maths for /me. Pure, so it can be tested without a database. */

export type SimPoint = { id: string; date: Date; ratios: Record<Dimension, number | null> };

/** Each dimension as a share of its max; null when it was not assessed (max 0). */
export function simRatios(score: Score): Record<Dimension, number | null> {
  const out = {} as Record<Dimension, number | null>;
  for (const d of DIMENSIONS) {
    const { score: got, max } = score.dimensions[d];
    out[d] = max > 0 ? got / max : null;
  }
  return out;
}

export type ReasonAccuracy = Record<Exclude<DrillReason, "none"> | "none", { seen: number; spotted: number }>;

/** Across all drills: for each kind of error, how often it was spotted. */
export function drillAccuracy(scores: readonly DrillScore[]): ReasonAccuracy {
  const acc = Object.fromEntries(DRILL_REASONS.map((r) => [r, { seen: 0, spotted: 0 }])) as ReasonAccuracy;
  for (const score of scores) {
    for (const item of score.items) {
      acc[item.truthReason].seen++;
      if (item.sentenceCorrect) acc[item.truthReason].spotted++;
    }
  }
  return acc;
}

export type NextStep =
  | { kind: "start"; reason: string }
  | { kind: "drill"; reason: string }
  | { kind: "sim"; reason: string };

const DIMENSION_NAMES: Record<Dimension, string> = {
  correctness: "getting the numbers right",
  aiJudgment: "catching AI mistakes",
  reasoning: "written reasoning",
  process: "working process",
};

/**
 * The one recommendation on /me. The weakest simulation dimension (averaged
 * over the recent sims shown) decides: number- and AI-checking skills are
 * what the drill trains, so those point to today's drill unless it is done;
 * everything else points to another simulation.
 */
export function nextStep(input: { sims: SimPoint[]; drillDoneToday: boolean; accuracy: ReasonAccuracy }): NextStep {
  const { sims, drillDoneToday, accuracy } = input;
  if (sims.length === 0) {
    return drillDoneToday
      ? { kind: "sim", reason: "You have done the drill. The 15-minute simulation is where a full proof comes from." }
      : { kind: "start", reason: "Start with the 3-minute drill, or go straight to the 15-minute simulation." };
  }

  const averages = DIMENSIONS.map((d) => {
    const values = sims.map((s) => s.ratios[d]).filter((v): v is number => v !== null);
    return { d, avg: values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length };
  }).filter((x): x is { d: Dimension; avg: number } => x.avg !== null);
  const weakest = averages.sort((a, b) => a.avg - b.avg)[0];

  const drillable = weakest && (weakest.d === "aiJudgment" || weakest.d === "correctness");
  if (drillable && !drillDoneToday) {
    const weakReason = (["wrong_math", "fabricated_source", "wrong_conclusion"] as const)
      .filter((r) => accuracy[r].seen > 0)
      .sort((a, b) => accuracy[a].spotted / accuracy[a].seen - accuracy[b].spotted / accuracy[b].seen)[0];
    const extra = weakReason ? ` Watch for ${weakReason.replace("_", " ")}: your weakest error type in drills so far.` : "";
    return {
      kind: "drill",
      reason: `Your weakest area is ${DIMENSION_NAMES[weakest.d]} (${Math.round(weakest.avg * 100)}%). Today's drill trains exactly that.${extra}`,
    };
  }
  return {
    kind: "sim",
    reason: weakest
      ? `Your weakest area is ${DIMENSION_NAMES[weakest.d]} (${Math.round(weakest.avg * 100)}%). Another simulation is the way to move it.`
      : "Take another simulation to build up your record.",
  };
}
