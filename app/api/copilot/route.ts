import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { and, count, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { getAnonId } from "@/lib/anon";
import { jsonError, readJson } from "@/lib/api";
import { getOwnedSimAttempt, loadChat, newMessageId } from "@/lib/attempts";
import { pickClaim } from "@/lib/copilot";
import { writeCopilotReply } from "@/lib/copilot-reply";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import type { AiResponsePayload, PromptPayload } from "@/lib/events/schema";
import { MAX_MESSAGE_CHARS, MAX_USER_MESSAGES } from "@/lib/sim-config";
import { buildVariant } from "@/lib/variant";

export const maxDuration = 30;

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
 * first token within 8s). A seeded claim is always the same fixed sentence,
 * streamed before either of them writes anything, and the same logging and
 * server-generated message ids apply. The reply is labelled with its source.
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

      const { reply, source } = await writeCopilotReply({
        variant,
        claim,
        message: text,
        history: chat.messages,
        emit: (delta) => writer.write({ type: "text-delta", id: textId, delta }),
        onModelError: (error) => console.error("copilot model failed", { attemptId: attempt.id, error }),
      });

      const logged: AiResponsePayload = {
        messageId,
        text: reply,
        trapId: claim,
        trapAttempted: claim,
        exposed: claim !== null,
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
