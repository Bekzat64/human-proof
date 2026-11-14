import { z } from "zod";
import { CHANNELS } from "../scenarios/types";
import {
  FLAG_NOTE_MAX_CHARS,
  FLAG_NOTE_MIN_CHARS,
  MAX_EVENTS_PER_BATCH,
} from "../sim-config";

/**
 * Process-capture events the BROWSER may report.
 *
 * `prompt`, `ai_response` and `submit` are deliberately absent: those are
 * written only by the server (copilot and submit routes), so a candidate
 * cannot forge what the copilot said or when they submitted.
 *
 * Every object is strict. In particular a paste event can only carry a
 * character count and a target — never the pasted text.
 */

export const ANSWER_FIELDS = ["q1", "q2", "q3", "q4"] as const;
export type AnswerField = (typeof ANSWER_FIELDS)[number];

/** `at` = when it happened on the client clock (epoch ms). */
const event = <Type extends string, Payload extends z.ZodType>(type: Type, payload: Payload) =>
  z.strictObject({ type: z.literal(type), at: z.number().int().positive(), payload });

export const clientEventSchema = z.discriminatedUnion("type", [
  event(
    "flag",
    z.strictObject({
      messageId: z.string().min(1).max(64),
      note: z.string().trim().min(FLAG_NOTE_MIN_CHARS).max(FLAG_NOTE_MAX_CHARS),
    }),
  ),
  event(
    "paste",
    z.strictObject({
      target: z.enum([...ANSWER_FIELDS, "copilot"]),
      chars: z.number().int().min(0).max(1_000_000),
    }),
  ),
  event("blur", z.strictObject({})),
  event(
    "focus",
    z.strictObject({
      /** How long the tab was away, in ms. */
      awayMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
    }),
  ),
  event(
    "answer_edit",
    z.strictObject({
      field: z.enum(ANSWER_FIELDS),
      /** Length after the edit — the text itself is only stored on submit. */
      chars: z.number().int().min(0).max(100_000),
    }),
  ),
  event(
    "data_view",
    z.discriminatedUnion("action", [
      z.strictObject({ action: z.literal("view") }),
      z.strictObject({
        action: z.literal("sort"),
        column: z.string().min(1).max(32),
        direction: z.enum(["asc", "desc"]),
      }),
      z.strictObject({
        action: z.literal("filter"),
        channel: z.enum([...CHANNELS, "all"]),
      }),
      z.strictObject({ action: z.literal("download") }),
    ]),
  ),
]);

export const eventBatchSchema = z.strictObject({
  attemptId: z.string().min(1).max(64),
  events: z.array(clientEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});

export type ClientEvent = z.infer<typeof clientEventSchema>;
/** A client event before the logger stamps it with a time. */
export type ClientEventInput = ClientEvent extends infer E
  ? E extends { at: number }
    ? Omit<E, "at">
    : never
  : never;
export type EventBatch = z.infer<typeof eventBatchSchema>;

// --- Server-written events (never accepted from the browser) -----------------

export type SeededClaimId = "T1" | "T2" | "T3";

export type PromptPayload = { messageId: string; text: string };

export type AiResponsePayload = {
  /** Generated on the server; the browser shows the same id, and flags reference it. */
  messageId: string;
  text: string;
  /** The seeded claim this reply opens with (fixed text, so it always appears). */
  trapId: SeededClaimId | null;
  /** Same as `trapId`; kept so rows written before claims became fixed text read the same. */
  trapAttempted: SeededClaimId | null;
  exposed: boolean;
  /** Who wrote it: the model, the deterministic offline copilot, or the fixed opener. */
  source?: ReplySource;
};

export type ReplySource = "llm" | "offline" | "template";

export type SubmitPayload = { elapsedSec: number; overtimeSec: number };
