import type { Channel, TrapId } from "../scenarios/types";

/** Shape of `attempts.score`. Types only: safe to import anywhere. */

export const LEVELS = ["Developing", "Proficient", "Advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const DIMENSIONS = ["correctness", "aiJudgment", "reasoning", "process"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const RUBRIC_CRITERIA = [
  "evidenceBased",
  "addressesCause",
  "actionable",
  "clearConcise",
  "statesVerification",
] as const;
export type RubricCriterion = (typeof RUBRIC_CRITERIA)[number];

/** Reasoning & communication, 0–5 per criterion. */
export type Rubric = {
  /** "llm" = scored by the grader model; "heuristic" = rule-based estimate. */
  source: "llm" | "heuristic";
  criteria: Record<RubricCriterion, number>;
  strength: string;
  gap: string;
  /** Exactly three bullets for the employer view. */
  employerSummary: string[];
  nextDrill: Dimension;
};

export type TrapOutcome =
  | "caught_by_flag_and_answer"
  | "caught_by_flag"
  | "caught_by_answer"
  | "missed"
  | "not_shown";

export type TrapResult = {
  id: TrapId;
  /** Did the copilot verifiably make this claim during the attempt? */
  exposed: boolean;
  /** What the AI claimed. */
  claimed: string;
  /** What was true. */
  truth: string;
  flagged: boolean;
  /** The final answer does not rely on the claim. */
  avoided: boolean;
  outcome: TrapOutcome;
  points: number;
  max: number;
};

export type Score = {
  version: "v1";
  total: number;
  level: Level;
  dimensions: {
    correctness: {
      score: number;
      max: number;
      q1: { correct: boolean; answer: number; truth: number; points: number; max: number };
      q2: { correct: boolean; answer: Channel; truth: Channel; points: number; max: number };
    };
    aiJudgment: { score: number; max: number; exposed: number; caught: number };
    reasoning: { score: number; max: number } & Rubric & {
        /** True when grader-directed text was found and the rubric was capped. */
        capped: boolean;
      };
    process: {
      score: number;
      max: number;
      checks: {
        inspectedData: boolean;
        usedCopilot: boolean;
        questionedAi: boolean;
        withinTime: boolean;
      };
    };
  };
  traps: TrapResult[];
  integrityNotes: string[];
};
