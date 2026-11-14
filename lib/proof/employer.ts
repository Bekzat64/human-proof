import type { Dimension, Score, TrapOutcome, TrapResult } from "../grading/types";

/** Wording for the Proof and employer pages, derived from a stored score. Pure. */

export const DIMENSION_LABELS: Record<Dimension, string> = {
  correctness: "Correctness",
  aiJudgment: "AI judgment",
  reasoning: "Reasoning & communication",
  process: "Process",
};

/** How the next-practice call to action names each dimension. */
export const PRACTICE_LABELS: Record<Dimension, string> = {
  correctness: "getting the numbers right",
  aiJudgment: "catching AI mistakes",
  reasoning: "written reasoning",
  process: "your working process",
};

export const OUTCOME_LABELS: Record<TrapOutcome, string> = {
  caught_by_flag_and_answer: "Caught — flagged it and did not rely on it",
  caught_by_flag: "Caught by flag — but the final answer still relied on it",
  caught_by_answer: "Caught by answer — not flagged, not relied on",
  missed: "Missed — the final answer relied on it",
  not_shown: "Not shown in this attempt",
};

export const exposedTraps = (score: Score): TrapResult[] => score.traps.filter((t) => t.exposed);

export const falseFlags = (score: Score): number => score.dimensions.aiJudgment.falseFlags ?? 0;
export const otherFlags = (score: Score): number => score.dimensions.aiJudgment.otherFlags ?? 0;

/** One line an employer can read in five seconds. */
export function verdictLine(score: Score): string {
  const { exposed, caught } = score.dimensions.aiJudgment;
  const errors = exposed === 0 ? "no seeded AI errors were shown" : `caught ${caught} of ${exposed} seeded AI errors`;
  const read =
    score.level === "Advanced"
      ? "Checks AI output before relying on it."
      : score.level === "Proficient"
        ? "Catches AI mistakes, with the gaps listed below."
        : "On this attempt, relied on AI output that was wrong.";
  return `${score.level}, ${score.total}/100 — ${errors}. ${read}`;
}

/**
 * The three bullets of the employer view.
 *
 * When the written answers were scored by the grader model, the stored
 * summary is used. When they were only estimated by rules, the bullets are
 * built here from the deterministic results alone and marked as estimated,
 * so nothing an employer reads leans on a number no model has reviewed.
 */
export function employerBullets(score: Score): { bullets: string[]; estimated: boolean } {
  const { correctness, aiJudgment, reasoning, process } = score.dimensions;
  if (reasoning.source === "llm") return { bullets: reasoning.employerSummary.slice(0, 3), estimated: false };

  const shown = exposedTraps(score);
  const byFlag = shown.filter((t) => t.flagged).length;
  const missed = shown.filter((t) => t.outcome === "missed").length;
  const yesNo = (ok: boolean) => (ok ? "yes" : "no");

  return {
    estimated: true,
    bullets: [
      shown.length === 0
        ? "The copilot made no seeded errors in this attempt, so AI judgment was not assessed."
        : `Caught ${aiJudgment.caught} of ${aiJudgment.exposed} seeded AI errors: ${byFlag} flagged as wrong during the work, ${missed} carried into the final answer.`,
      `September churn rate: answered ${correctness.q1.answer}%, ${correctness.q1.correct ? "correct" : `not within 0.3pp of ${correctness.q1.truth}%`}. Channel behind the increase: answered ${correctness.q2.answer}, ${correctness.q2.correct ? "correct" : `it was ${correctness.q2.truth}`}.`,
      `Working process: sorted, filtered or downloaded the data — ${yesNo(process.checks.inspectedData)}; questioned the AI — ${yesNo(process.checks.questionedAi)}; finished within 15 minutes — ${yesNo(process.checks.withinTime)}.`,
    ],
  };
}
