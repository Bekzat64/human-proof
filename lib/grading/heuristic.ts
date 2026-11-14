import { countWords, type Answer } from "../answers";
import { CHANNELS, type Variant } from "../scenarios/types";
import type { Rubric, RubricCriterion } from "./types";

/**
 * Rule-based estimate of the Reasoning & communication rubric, used when no
 * grader model is configured. It can only look at surface features, so it is
 * stored with source "heuristic", shown as "estimated", and never awards a 5.
 */

const ACTION_WORDS =
  /\b(pause|audit|investigate|review|reduce|cut|stop|fix|test|reallocate|shift|contact|survey|offer|improve|launch|tighten|monitor|segment|interview|refund|win[- ]back)\w*/i;
const VERIFICATION_WORDS =
  /\b(verif|check|recomput|recalculat|re-?calculat|cross-?check|compar|confirm|reconcil|did(n't| not) trust|not trust|flagged|denominator|start[- ]of[- ]month)\w*/i;

/** Text written at the grader rather than about the task. */
const GRADER_DIRECTED =
  /ignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|rules|prompt)|give (this|the) candidate|award (me|this)|score of (100|full)|full marks|system prompt|you are (the|a) grader/i;

export function addressesTheGrader(answer: Answer): boolean {
  return GRADER_DIRECTED.test(answer.q3) || GRADER_DIRECTED.test(answer.q4);
}

/**
 * If the answer contains instructions aimed at the grader, treat it as
 * carrying no evidence and hold every other criterion to 2 or below. Applied
 * to model-scored and heuristic rubrics alike.
 */
export function capForInjection(criteria: Record<RubricCriterion, number>): Record<RubricCriterion, number> {
  return {
    evidenceBased: 0,
    addressesCause: Math.min(criteria.addressesCause, 2),
    actionable: Math.min(criteria.actionable, 2),
    clearConcise: Math.min(criteria.clearConcise, 2),
    statesVerification: Math.min(criteria.statesVerification, 2),
  };
}

export function heuristicCriteria(variant: Variant, answer: Answer): Record<RubricCriterion, number> {
  const both = `${answer.q3} ${answer.q4}`;
  const numbers = both.match(/\d+(?:[.,]\d+)?\s?(?:%|pp|percent)?/g)?.length ?? 0;
  const q3Words = countWords(answer.q3);
  const namesChannel = CHANNELS.some((channel) => answer.q3.toLowerCase().includes(channel.toLowerCase()));
  const namesDriver = answer.q3.toLowerCase().includes(variant.groundTruth.drivingChannel.toLowerCase());

  return {
    evidenceBased: numbers >= 2 ? 4 : numbers === 1 ? 3 : 1,
    addressesCause: namesDriver ? 4 : namesChannel ? 3 : 1,
    actionable: ACTION_WORDS.test(answer.q3) ? (q3Words >= 15 ? 4 : 3) : q3Words >= 15 ? 2 : 1,
    clearConcise: q3Words >= 25 && q3Words <= 120 ? 4 : q3Words >= 10 ? 3 : 1,
    statesVerification: VERIFICATION_WORDS.test(answer.q4) ? 4 : answer.q4.trim().length >= 20 ? 2 : 1,
  };
}

const LABEL: Record<RubricCriterion, string> = {
  evidenceBased: "backing claims with numbers",
  addressesCause: "naming the cause",
  actionable: "making the recommendation actionable",
  clearConcise: "writing clearly and concisely",
  statesVerification: "stating what was verified",
};

export function heuristicRubric(variant: Variant, answer: Answer): Omit<Rubric, "nextDrill" | "employerSummary"> {
  const criteria = heuristicCriteria(variant, answer);
  const ranked = (Object.keys(criteria) as RubricCriterion[]).sort((a, b) => criteria[b] - criteria[a]);
  return {
    source: "heuristic",
    criteria,
    strength: `Strongest on ${LABEL[ranked[0]]} (automated estimate).`,
    gap: `Most room to improve on ${LABEL[ranked[ranked.length - 1]]} (automated estimate).`,
  };
}
