import { z } from "zod";

/** Employer feedback on a proof. Shared by the form and the API route. */

export const EMPLOYER_VERDICTS = ["would_interview", "not_yet"] as const;
export type EmployerVerdict = (typeof EMPLOYER_VERDICTS)[number];

export const VERDICT_LABELS: Record<EmployerVerdict, string> = {
  would_interview: "Would interview",
  not_yet: "Not yet",
};

export const FEEDBACK_NOTE_MAX_CHARS = 500;

export const feedbackSchema = z.strictObject({
  attemptId: z.string().min(1).max(64),
  verdict: z.enum(EMPLOYER_VERDICTS),
  note: z.string().trim().min(1).max(FEEDBACK_NOTE_MAX_CHARS).optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
