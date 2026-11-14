import { z } from "zod";
import { CHANNELS } from "./scenarios/types";

/** Answer form for scenario 1 (PLAN §5). Shared by the form and POST /api/submit. */

export const Q3_MAX_WORDS = 120;
export const Q4_MAX_WORDS = 60;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

const prose = (maxWords: number) =>
  z
    .string()
    .trim()
    .min(1, "Write an answer before submitting.")
    .max(5000)
    .refine((text) => countWords(text) <= maxWords, `Keep this to ${maxWords} words or fewer.`);

export const answerSchema = z.strictObject({
  /** Q1: September monthly churn rate, in percent. */
  q1: z
    .number({ error: "Enter a number, for example 7.4." })
    .min(0, "Churn cannot be negative.")
    .max(100, "Churn cannot be more than 100%."),
  /** Q2: the channel that drove the increase. */
  q2: z.enum(CHANNELS, { error: "Pick a channel." }),
  /** Q3: recommendation. */
  q3: prose(Q3_MAX_WORDS),
  /** Q4: what was verified / not trusted. */
  q4: prose(Q4_MAX_WORDS),
});

export type Answer = z.infer<typeof answerSchema>;

export const submitSchema = z.strictObject({
  attemptId: z.string().min(1).max(64),
  answer: answerSchema,
});

/** What the form holds while the candidate is typing: everything is still text. */
export type AnswerDraft = { q1: string; q2: string; q3: string; q4: string };

export const EMPTY_DRAFT: AnswerDraft = { q1: "", q2: "", q3: "", q4: "" };

/** Turn the form's strings into the shape `answerSchema` validates. */
export function draftToAnswerInput(draft: AnswerDraft) {
  const q1 = draft.q1.trim().replace(",", ".").replace(/%$/, "").trim();
  return {
    q1: q1 === "" ? undefined : Number(q1),
    q2: draft.q2 === "" ? undefined : draft.q2,
    q3: draft.q3,
    q4: draft.q4,
  };
}
