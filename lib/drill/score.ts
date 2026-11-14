import { z } from "zod";
import {
  DRILL_DURATION_MS,
  DRILL_ITEMS_PER_DAY,
  DRILL_REASONS,
  REASON_POINTS,
  SENTENCE_POINTS,
  type DrillAnswer,
  type DrillItem,
  type DrillItemResult,
  type DrillScore,
} from "./types";

/** What the browser submits. Strict: nothing but picks and timings. */
export const drillSubmitSchema = z.strictObject({
  attemptId: z.string().min(1).max(64),
  answers: z
    .array(
      z.strictObject({
        itemId: z.string().min(1).max(64),
        sentence: z.union([z.number().int().min(0).max(9), z.literal("none"), z.null()]),
        reason: z.enum(DRILL_REASONS).nullable(),
        ms: z.number().int().min(0).max(60 * 60 * 1000),
      }),
    )
    .max(DRILL_ITEMS_PER_DAY),
});

/**
 * Score a drill. Pure and server-side: the items carry the answer key.
 *
 * Per item: the right sentence (or "nothing wrong" when nothing is) is worth
 * 15 points and the right reason 5, so five items make 100. Items the
 * candidate did not answer, and answers for items that are not in today's
 * set, score nothing.
 */
export function scoreDrill(input: {
  date: string;
  items: readonly DrillItem[];
  answers: readonly DrillAnswer[];
  elapsedMs: number;
  countsForStreak: boolean;
  streak: number;
}): DrillScore {
  const byItem = new Map(input.answers.map((a) => [a.itemId, a]));

  const items: DrillItemResult[] = input.items.map((item) => {
    const answer = byItem.get(item.id);
    const pickedSentence = answer?.sentence ?? null;
    // "Nothing wrong" is both a sentence choice and a reason.
    const pickedReason = pickedSentence === "none" ? "none" : (answer?.reason ?? null);
    const truthSentence = item.wrongIndex ?? "none";
    const sentenceCorrect = pickedSentence !== null && pickedSentence === truthSentence;
    const reasonCorrect = pickedReason !== null && pickedReason === item.reason;
    return {
      itemId: item.id,
      domain: item.domain,
      pickedSentence,
      pickedReason,
      truthSentence,
      truthReason: item.reason,
      sentenceCorrect,
      reasonCorrect,
      points: (sentenceCorrect ? SENTENCE_POINTS : 0) + (reasonCorrect ? REASON_POINTS : 0),
      explanation: item.explanation,
    };
  });

  return {
    version: "drill-v1",
    kind: "drill",
    date: input.date,
    total: items.reduce((sum, item) => sum + item.points, 0),
    correct: items.filter((item) => item.sentenceCorrect).length,
    items,
    elapsedSec: Math.round(input.elapsedMs / 1000),
    overtimeSec: Math.max(0, Math.round((input.elapsedMs - DRILL_DURATION_MS) / 1000)),
    countsForStreak: input.countsForStreak,
    streak: input.streak,
  };
}

/**
 * Consecutive New York days with a completed drill, ending today, or
 * yesterday if today's drill has not been done yet (the streak is still
 * alive until the day ends). `dates` are YYYY-MM-DD keys in any order, with
 * repeats; several drills on one day count once.
 */
export function computeStreak(dates: readonly string[], today: string, previous: (dateKey: string) => string): number {
  const done = new Set(dates);
  let day = done.has(today) ? today : previous(today);
  let streak = 0;
  while (done.has(day)) {
    streak++;
    day = previous(day);
  }
  return streak;
}
