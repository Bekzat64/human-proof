import type { Answer } from "../answers";
import type { AiResponsePayload, SubmitPayload } from "../events/schema";
import { formatPct } from "../format";
import type { LoggedEvent } from "../integrity";
import type { TrapId, Variant } from "../scenarios/types";
import type { Level, Score, TrapOutcome, TrapResult } from "./types";

/**
 * Scoring v1 — everything that needs no judgment (75 of the 100 points).
 * Pure functions of the variant, the answer and the event log.
 */

export const WEIGHTS = { correctness: 35, aiJudgment: 30, reasoning: 25, process: 10 } as const;
const Q1_POINTS = 20;
const Q2_POINTS = 15;
/** Q1 is right within ±0.3 percentage points. */
export const Q1_TOLERANCE_PP = 0.3;
/**
 * Per exposed claim: 60% for an answer that does not rely on it, 40% for
 * flagging it. The flag share is multiplied by flag precision (flags on
 * seeded claims ÷ those plus flags on known-correct offline replies), so
 * flagging every reply is worth much less than flagging the right ones.
 */
const AVOIDED_SHARE = 0.6;
const FLAGGED_SHARE = 0.4;

const within = (a: number, b: number) => Math.abs(a - b) <= Q1_TOLERANCE_PP + 1e-9;
export const round1 = (value: number) => Math.round(value * 10) / 10;

export function levelFor(total: number): Level {
  return total >= 75 ? "Advanced" : total >= 50 ? "Proficient" : "Developing";
}

/** Does the text lean on the invented benchmark (its number or the idea of one)? */
function citesBenchmark(text: string, benchmarkPct: number): boolean {
  const number = new RegExp(`(^|[^\\d.])${benchmarkPct}(\\.0)?\\s?(%|percent)`, "i");
  return number.test(text) || /industry|benchmark/i.test(text);
}

export type FlagStats = {
  /** Distinct copilot messages flagged. */
  flags: number;
  /** Flags on offline (deterministic, known-correct) replies that carried no seeded claim. */
  falseFlags: number;
  /** Flags on model-written replies that carried no seeded claim. Not judged: a model can be wrong unprompted. */
  otherFlags: number;
  /** Copilot replies that carried no seeded claim. */
  plainReplies: number;
  /**
   * Most replies without a seeded claim were flagged: flagging as a habit,
   * not a judgment. When true, flags earn nothing on any trap.
   */
  indiscriminate: boolean;
  precision: number;
};

/** Flagging more than this share of the replies that carried no seeded claim counts as indiscriminate. */
export const INDISCRIMINATE_FLAG_SHARE = 0.5;
/** …but one stray flag on a short conversation is not a habit. */
const MIN_PLAIN_FLAGS_FOR_INDISCRIMINATE = 2;

/**
 * What the candidate flagged. A flag on a reply without a seeded claim is a
 * mistake only when that reply is known to be correct, i.e. it came from the
 * deterministic offline copilot. A model-written reply may really contain an
 * error of its own, so a flag on it is counted neutrally and leaves precision
 * alone.
 */
export function flagStats(events: readonly LoggedEvent[]): FlagStats {
  const replies = new Map<string, AiResponsePayload>();
  for (const e of events) {
    if (e.type !== "ai_response") continue;
    const reply = e.payload as AiResponsePayload;
    replies.set(reply.messageId, reply);
  }
  const flagged = new Set(
    events.filter((e) => e.type === "flag").map((e) => (e.payload as { messageId: string }).messageId),
  );
  let onClaims = 0;
  let falseFlags = 0;
  for (const id of flagged) {
    const reply = replies.get(id);
    if (reply?.trapId) onClaims++;
    else if (reply?.source === "offline") falseFlags++;
  }
  const judged = onClaims + falseFlags;
  // Whoever wrote them (model or offline copilot), flags on most of the
  // replies that carried no seeded claim mean the flag button is being used
  // on everything. Measured against those replies only, so a candidate who
  // flags exactly the seeded mistakes is never caught by this.
  const plainReplies = [...replies.values()].filter((r) => !r.trapId).length;
  const plainFlags = flagged.size - onClaims;
  const indiscriminate =
    plainFlags >= MIN_PLAIN_FLAGS_FOR_INDISCRIMINATE && plainFlags > plainReplies * INDISCRIMINATE_FLAG_SHARE;
  return {
    flags: flagged.size,
    falseFlags,
    otherFlags: flagged.size - judged,
    plainReplies,
    indiscriminate,
    precision: judged === 0 ? 1 : onClaims / judged,
  };
}

export function gradeTraps(variant: Variant, answer: Answer, events: readonly LoggedEvent[]): TrapResult[] {
  const { traps, groundTruth: truth } = variant;

  // Which claims were verifiably shown, and in which copilot message.
  const shownIn = new Map<TrapId, string>();
  for (const e of events) {
    if (e.type !== "ai_response") continue;
    const reply = e.payload as AiResponsePayload;
    if (reply.trapId && !shownIn.has(reply.trapId)) shownIn.set(reply.trapId, reply.messageId);
  }
  const flaggedMessages = new Set(
    events.filter((e) => e.type === "flag").map((e) => (e.payload as { messageId: string }).messageId),
  );

  const avoided: Record<TrapId, boolean> = {
    T1: !within(answer.q1, traps.T1.trapValue),
    // Mentioning the benchmark while verifying (Q4) is questioning it; leaning
    // on it only in the recommendation (Q3) is using it.
    T2: citesBenchmark(answer.q4, traps.T2.trapValue) || !citesBenchmark(answer.q3, traps.T2.trapValue),
    T3: answer.q2 !== traps.T3.trapValue,
  };
  const truths: Record<TrapId, string> = {
    T1: `September churn is ${formatPct(truth.sepChurnRate, 2)}% (cancellations ÷ start-of-month subscribers).`,
    T2: `No such report exists; against the company's own Apr–Aug baseline of ${formatPct(truth.baselineChurnRate, 2)}%, September is not normal.`,
    T3: `${truth.drivingChannel} had the largest churn-rate increase.`,
  };

  const { precision, indiscriminate } = flagStats(events);
  const flagWeight = indiscriminate ? 0 : precision;
  const exposedCount = shownIn.size;
  const max = exposedCount === 0 ? 0 : WEIGHTS.aiJudgment / exposedCount;

  return (["T1", "T2", "T3"] as const).map((id) => {
    const messageId = shownIn.get(id);
    const exposed = messageId !== undefined;
    const flagged = exposed && flaggedMessages.has(messageId);
    const outcome: TrapOutcome = !exposed
      ? "not_shown"
      : flagged && avoided[id]
        ? "caught_by_flag_and_answer"
        : flagged
          ? "caught_by_flag"
          : avoided[id]
            ? "caught_by_answer"
            : "missed";
    return {
      id,
      exposed,
      claimed: traps[id].wrongClaim,
      truth: truths[id],
      flagged,
      avoided: exposed && avoided[id],
      outcome,
      points: exposed ? round1(max * ((avoided[id] ? AVOIDED_SHARE : 0) + (flagged ? FLAGGED_SHARE * flagWeight : 0))) : 0,
      max: exposed ? round1(max) : 0,
    };
  });
}

export function gradeCorrectness(
  variant: Variant,
  answer: Answer,
  /** With no claim exposed, AI judgment's 30 points move here, proportionally. */
  scale: number,
): Score["dimensions"]["correctness"] {
  const truth = variant.groundTruth;
  const q1Correct = within(answer.q1, truth.sepChurnRate);
  const q2Correct = answer.q2 === truth.drivingChannel;
  const q1Max = round1(Q1_POINTS * scale);
  const q2Max = round1(Q2_POINTS * scale);
  const q1 = { correct: q1Correct, answer: answer.q1, truth: truth.sepChurnRate, points: q1Correct ? q1Max : 0, max: q1Max };
  const q2 = { correct: q2Correct, answer: answer.q2, truth: truth.drivingChannel, points: q2Correct ? q2Max : 0, max: q2Max };
  return { score: round1(q1.points + q2.points), max: round1(WEIGHTS.correctness * scale), q1, q2 };
}

export function gradeProcess(answer: Answer, events: readonly LoggedEvent[]): Score["dimensions"]["process"] {
  const submit = events.find((e) => e.type === "submit")?.payload as SubmitPayload | undefined;
  const checks = {
    // Sorting, filtering or downloading: something the candidate did. The
    // automatic "table came into view" event does not count.
    inspectedData: events.some(
      (e) => e.type === "data_view" && (e.payload as { action?: string } | null)?.action !== "view",
    ),
    usedCopilot: events.some((e) => e.type === "prompt"),
    questionedAi: events.some((e) => e.type === "flag") || answer.q4.trim().length >= 20,
    withinTime: submit !== undefined && submit.overtimeSec === 0,
  };
  const score =
    (checks.inspectedData ? 3 : 0) + (checks.usedCopilot ? 2 : 0) + (checks.questionedAi ? 3 : 0) + (checks.withinTime ? 2 : 0);
  return { score, max: WEIGHTS.process, checks };
}
