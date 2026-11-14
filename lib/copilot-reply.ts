import "server-only";
import { streamText } from "ai";
import {
  COPILOT_MAX_OUTPUT_TOKENS,
  buildInstructions,
  claimSentence,
  toModelMessages,
  type ChatTurn,
  type LaterClaimId,
} from "./copilot";
import { offlineReply } from "./copilot-offline";
import type { ReplySource } from "./events/schema";
import { getModel, isLlmAvailable } from "./llm";
import type { Variant } from "./scenarios/types";

/** If the model has not started answering by then, the offline copilot answers instead. */
export const FIRST_TOKEN_TIMEOUT_MS = 8000;

export type CopilotReply = {
  reply: string;
  source: ReplySource;
  /** The fixed claim sentence the reply opened with, if any. */
  opening: string | null;
  /** ms from the start of the reply to the model's first token; null when no model answered. */
  firstModelTokenMs: number | null;
  totalMs: number;
};

/**
 * Write one copilot reply, chunk by chunk, through `emit`.
 *
 * A seeded claim is fixed text and goes out first, before anything else is
 * written. Then the configured LLM continues; if there is no key, the model
 * errors, or no token arrives within 8 s, the deterministic offline copilot
 * answers instead. Shared by POST /api/copilot and `pnpm llm:check`, so the
 * check exercises exactly what production runs.
 */
export async function writeCopilotReply(input: {
  variant: Variant;
  claim: LaterClaimId | null;
  message: string;
  history: readonly ChatTurn[];
  emit: (delta: string) => void;
  onModelError?: (error: unknown) => void;
}): Promise<CopilotReply> {
  const { variant, claim, message, history, onModelError } = input;
  const started = performance.now();
  let reply = "";
  const emit = (delta: string) => {
    reply += delta;
    input.emit(delta);
  };

  const opening = claim ? claimSentence(variant, claim) : null;
  if (opening) emit(`${opening}\n\n`);
  const openingLength = reply.length;

  let source: ReplySource = "offline";
  let firstModelTokenMs: number | null = null;
  if (isLlmAvailable()) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), FIRST_TOKEN_TIMEOUT_MS);
    try {
      const result = streamText({
        model: getModel("copilot"),
        instructions: buildInstructions(variant.publicData, opening),
        messages: toModelMessages(history, message),
        maxOutputTokens: COPILOT_MAX_OUTPUT_TOKENS,
        reasoning: "none", // short, fast replies; the cap above is for visible text
        abortSignal: abort.signal,
        onError: ({ error }) => onModelError?.(error),
      });
      for await (const delta of result.textStream) {
        clearTimeout(timer); // the model is answering: let it finish
        firstModelTokenMs ??= Math.round(performance.now() - started);
        emit(delta);
      }
    } catch (error) {
      onModelError?.(error);
    } finally {
      clearTimeout(timer);
    }
    // Anything the model wrote stays, even if it then failed mid-reply.
    if (reply.slice(openingLength).trim() !== "") source = "llm";
  }
  if (source === "offline") emit(offlineReply(variant, message));

  return { reply, source, opening, firstModelTokenMs, totalMs: Math.round(performance.now() - started) };
}
