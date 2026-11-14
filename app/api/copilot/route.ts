import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { and, count, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { getAnonId } from "@/lib/anon";
import { jsonError, readJson } from "@/lib/api";
import { getOwnedSimAttempt, loadChat, newMessageId } from "@/lib/attempts";
import {
  COPILOT_MAX_OUTPUT_TOKENS,
  buildInstructions,
  claimAppears,
  pickClaim,
  toModelMessages,
} from "@/lib/copilot";
import { offlineReply } from "@/lib/copilot-offline";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import type { AiResponsePayload, PromptPayload, ReplySource } from "@/lib/events/schema";
import { getModel, isLlmAvailable } from "@/lib/llm";
import { MAX_MESSAGE_CHARS, MAX_USER_MESSAGES } from "@/lib/sim-config";
import { buildVariant } from "@/lib/variant";

export const maxDuration = 30;

/** If the model has not started answering by then, the offline copilot answers instead. */
const FIRST_TOKEN_TIMEOUT_MS = 8000;

const bodySchema = z.strictObject({
  attemptId: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});

const limitReached = () =>
  jsonError(
    "message_limit",
    `You have used all ${MAX_USER_MESSAGES} copilot messages for this attempt. You can still finish and submit your answers.`,
  );

/**
 * One copilot turn. The browser sends only the new message; history, the
 * message count and which seeded claims have been shown all come from the
 * events table.
 *
 * The reply comes from the configured LLM when there is one, and from the
 * deterministic offline copilot otherwise (no key, provider error, or no
 * first token within 8s). Either way the same claim rules, logging and
 * server-generated message ids apply, and the reply is labelled with its source.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError("invalid_input", `Messages must be 1–${MAX_MESSAGE_CHARS} characters.`);
  }
  const { attemptId, text } = parsed.data;

  const attempt = await getOwnedSimAttempt(attemptId, await getAnonId());
  if (!attempt) return jsonError("not_found", "This simulation does not exist.");
  if (attempt.status !== "active") {
    return jsonError("not_active", "This simulation has already been submitted.");
  }

  const chat = await loadChat(attempt.id);
  if (chat.userMessageCount >= MAX_USER_MESSAGES) return limitReached();

  const db = getDb();
  const prompt: PromptPayload = { messageId: newMessageId(), text };
  const [inserted] = await db
    .insert(events)
    .values({ attemptId: attempt.id, type: "prompt", payload: prompt })
    .returning({ id: events.id });

  // Enforce the limit on what was actually written, so parallel requests
  // cannot all slip past the check above: a prompt only counts if it is among
  // the first MAX_USER_MESSAGES by insertion order.
  const [{ position }] = await db
    .select({ position: count() })
    .from(events)
    .where(and(eq(events.attemptId, attempt.id), eq(events.type, "prompt"), lte(events.id, inserted.id)));
  if (position > MAX_USER_MESSAGES) {
    await db.delete(events).where(eq(events.id, inserted.id));
    return limitReached();
  }

  const variant = buildVariant(attempt.seed);
  const claim = pickClaim({ message: text, userMessageNumber: position, history: chat.claims });

  // The reply's id is created here and sent in the stream's first chunk, so
  // the id the browser shows is the id in the log — flags reference it.
  const messageId = newMessageId();
  const textId = "reply";

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId });
      writer.write({ type: "text-start", id: textId });

      let reply = "";
      const emit = (delta: string) => {
        reply += delta;
        writer.write({ type: "text-delta", id: textId, delta });
      };

      let source: ReplySource = "offline";
      if (isLlmAvailable()) {
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), FIRST_TOKEN_TIMEOUT_MS);
        try {
          const result = streamText({
            model: getModel("copilot"),
            instructions: buildInstructions(variant, claim),
            messages: toModelMessages(chat.messages, text),
            maxOutputTokens: COPILOT_MAX_OUTPUT_TOKENS,
            reasoning: "none", // short, fast replies; the cap above is for visible text
            abortSignal: abort.signal,
            onError: ({ error }) => console.error("copilot model failed", { attemptId: attempt.id, error }),
          });
          for await (const delta of result.textStream) {
            clearTimeout(timer); // the model is answering: let it finish
            emit(delta);
          }
          if (reply.trim() !== "") source = "llm";
        } catch (error) {
          console.error("copilot model failed", { attemptId: attempt.id, error });
          if (reply.trim() !== "") source = "llm"; // keep what was already shown
        } finally {
          clearTimeout(timer);
        }
      }
      if (source === "offline") emit(offlineReply(variant, text, claim));

      // Record the claim as shown only if it verifiably made it into the reply.
      const exposed = claim !== null && claimAppears(variant, claim, reply);
      const logged: AiResponsePayload = {
        messageId,
        text: reply,
        trapId: exposed ? claim : null,
        trapAttempted: claim,
        exposed,
        source,
      };
      await db.insert(events).values({ attemptId: attempt.id, type: "ai_response", payload: logged });

      writer.write({ type: "text-end", id: textId });
      writer.write({ type: "finish", messageMetadata: { source } });
    },
    onError: () => "The copilot hit a problem. Try sending that again.",
  });

  return createUIMessageStreamResponse({ stream });
}
