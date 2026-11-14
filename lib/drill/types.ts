/** Daily drill: shapes shared by content, scoring, API and UI. Types and labels only: safe on the client. */

export const DRILL_REASONS = ["wrong_math", "fabricated_source", "wrong_conclusion", "none"] as const;
export type DrillReason = (typeof DRILL_REASONS)[number];

export const REASON_LABELS: Record<DrillReason, string> = {
  wrong_math: "Wrong math",
  fabricated_source: "Fabricated source",
  wrong_conclusion: "Wrong conclusion",
  none: "Nothing wrong",
};

export const DRILL_DOMAINS = ["marketing", "ops", "finance", "product", "sales"] as const;
export type DrillDomain = (typeof DRILL_DOMAINS)[number];

export type DrillTable = { columns: string[]; rows: (string | number)[][] };

/** What the browser gets while a drill is running: no answer, no explanation. */
export type PublicDrillItem = {
  id: string;
  domain: DrillDomain;
  context: string;
  table: DrillTable;
  /** The AI's answer, one entry per sentence. */
  sentences: string[];
};

/** The full item, answer key included. Lives only on the server. */
export type DrillItem = PublicDrillItem & {
  /** Index of the one wrong sentence, or null when nothing is wrong. */
  wrongIndex: number | null;
  reason: DrillReason;
  /** One line shown after submit. */
  explanation: string;
  /**
   * For wrong-math items: the figure the AI stated and how to recompute the
   * true one from the table, so a test can prove the stated figure is wrong.
   */
  check?: { claimed: number; compute: (rows: (string | number)[][]) => number };
};

export const DRILL_ITEMS_PER_DAY = 5;
export const DRILL_DURATION_MS = 3 * 60 * 1000;
export const SENTENCE_POINTS = 15;
export const REASON_POINTS = 5;

/** A candidate's answer to one item. `sentence` is an index, "none" (nothing wrong) or null (unanswered). */
export type DrillAnswer = {
  itemId: string;
  sentence: number | "none" | null;
  reason: DrillReason | null;
  /** Time spent with this item on screen, in ms. */
  ms: number;
};

export type DrillItemResult = {
  itemId: string;
  domain: DrillDomain;
  pickedSentence: number | "none" | null;
  pickedReason: DrillReason | null;
  truthSentence: number | "none";
  truthReason: DrillReason;
  sentenceCorrect: boolean;
  reasonCorrect: boolean;
  points: number;
  explanation: string;
};

/** Shape of `attempts.score` for a drill. */
export type DrillScore = {
  version: "drill-v1";
  kind: "drill";
  /** The America/New_York date the drill belongs to, YYYY-MM-DD. */
  date: string;
  total: number;
  /** Items where the wrong sentence (or "nothing wrong") was identified. */
  correct: number;
  items: DrillItemResult[];
  elapsedSec: number;
  overtimeSec: number;
  /** True for the first completed drill of that day for this visitor; only that one counts toward the streak. */
  countsForStreak: boolean;
  /** Streak in days as of this drill. */
  streak: number;
};
