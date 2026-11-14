import type { Answer } from "../answers";
import { integrityNotes, type LoggedEvent } from "../integrity";
import type { Variant } from "../scenarios/types";
import {
  WEIGHTS,
  flagStats,
  gradeCorrectness,
  gradeProcess,
  gradeTraps,
  levelFor,
  round1,
} from "./deterministic";
import { addressesTheGrader, capForInjection, heuristicRubric } from "./heuristic";
import { DIMENSIONS, RUBRIC_CRITERIA, type Dimension, type Rubric, type Score } from "./types";

type RubricCore = Pick<Rubric, "source" | "criteria" | "strength" | "gap">;

export type ScoringInput = {
  variant: Variant;
  answer: Answer;
  events: readonly LoggedEvent[];
};

/**
 * Scoring v1: turn an attempt into its score. Pure — the same input always
 * gives the same score, which is what makes regrading idempotent.
 *
 * `rubric` is the model's reasoning rubric when there is one; without it the
 * heuristic estimate is used.
 */
export function scoreAttempt(input: ScoringInput, rubric?: RubricCore | null): Score {
  const { variant, answer, events } = input;

  const traps = gradeTraps(variant, answer, events);
  const flags = flagStats(events);
  const exposed = traps.filter((t) => t.exposed);

  // No claim was shown: AI judgment cannot be assessed, so its 30 points move
  // into Correctness proportionally and the total is still out of 100.
  const noneExposed = exposed.length === 0;
  const correctness = gradeCorrectness(
    variant,
    answer,
    noneExposed ? (WEIGHTS.correctness + WEIGHTS.aiJudgment) / WEIGHTS.correctness : 1,
  );
  const aiJudgment = {
    score: round1(exposed.reduce((total, t) => total + t.points, 0)),
    max: noneExposed ? 0 : WEIGHTS.aiJudgment,
    exposed: exposed.length,
    caught: exposed.filter((t) => t.outcome !== "missed").length,
    flags: flags.flags,
    falseFlags: flags.falseFlags,
    otherFlags: flags.otherFlags,
    flagPrecision: Math.round(flags.precision * 100) / 100,
  };
  const process = gradeProcess(answer, events);

  const core = rubric ?? heuristicRubric(variant, answer);
  const capped = addressesTheGrader(answer);
  const criteria = capped ? capForInjection(core.criteria) : core.criteria;
  const reasoningScore = RUBRIC_CRITERIA.reduce((total, key) => total + criteria[key], 0);

  const ratios: Record<Dimension, number> = {
    correctness: correctness.score / correctness.max,
    aiJudgment: noneExposed ? 1 : aiJudgment.score / aiJudgment.max,
    reasoning: reasoningScore / WEIGHTS.reasoning,
    process: process.score / process.max,
  };
  const nextDrill = [...DIMENSIONS].sort((a, b) => ratios[a] - ratios[b])[0];

  const total = Math.round(correctness.score + aiJudgment.score + reasoningScore + process.score);
  const notes = integrityNotes(events);
  if (flags.falseFlags > 0) {
    notes.push(
      `Flagged ${flags.falseFlags} correct ${flags.falseFlags === 1 ? "answer" : "answers"} as wrong; this reduced the credit for flags.`,
    );
  }
  if (flags.otherFlags > 0) {
    notes.push(`Flagged ${flags.otherFlags} other ${flags.otherFlags === 1 ? "reply" : "replies"}.`);
  }
  if (capped) notes.push("The written answers contain text addressed to the grader; it was ignored.");

  return {
    version: "v1",
    total,
    level: levelFor(total),
    dimensions: {
      correctness,
      aiJudgment,
      reasoning: {
        score: reasoningScore,
        max: WEIGHTS.reasoning,
        source: core.source,
        criteria,
        strength: core.strength,
        gap: core.gap,
        employerSummary: [
          noneExposed
            ? "The copilot made no seeded mistakes in this attempt, so AI judgment was not assessed."
            : `Caught ${aiJudgment.caught} of ${aiJudgment.exposed} seeded AI mistakes.`,
          `September churn figure: ${correctness.q1.correct ? "correct" : "incorrect"}. Channel behind the increase: ${correctness.q2.correct ? "correct" : "incorrect"}.`,
          core.source === "llm" ? core.strength : "Written reasoning was scored by an automated estimate, not yet by a model.",
        ],
        nextDrill,
        capped,
      },
      process,
    },
    traps,
    integrityNotes: notes,
  };
}
