import { z } from "zod";

/** Candidate outcome check-in on /me, after their first proof. Shared by the form and the API. */

export const CHECKIN_QUESTIONS = ["shared_proof", "got_interview"] as const;
export type CheckinQuestion = (typeof CHECKIN_QUESTIONS)[number];

export const CHECKIN_LABELS: Record<CheckinQuestion, string> = {
  shared_proof: "Did you share your proof?",
  got_interview: "Got an interview?",
};

export const checkinSchema = z.strictObject({
  attemptId: z.string().min(1).max(64),
  question: z.enum(CHECKIN_QUESTIONS),
  answer: z.boolean(),
});
