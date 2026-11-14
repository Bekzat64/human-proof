import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { z } from "zod";
import { getAnonId } from "@/lib/anon";
import { jsonError, readJson } from "@/lib/api";
import { getOwnedSimAttempt, loadChat, newMessageId } from "@/lib/attempts";
import {
  COPILOT_MAX_OUTPUT_TOKENS,
  buildInstructions,
  claimAppears,
  copilotModel,
  pickClaim,
  toModelMessages,
} from "@/lib/copilot";
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

/**
 * One copilot turn. The browser sends only the new message; history, the
 * message count and which seeded claims have been shown all come from the
 * events table.
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
  if (chat.userMessageCount >= MAX_USER_MESSAGES) {
    return jsonError(
      "message_limit",
      `You have used all ${MAX_USER_MESSAGES} copilot messages for this attempt. You can still finish and submit your answers.`,
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("copilot_unavailable", "The copilot is not available right now. You can still work from the data.");
  }

  const variant = buildVariant(attempt.seed);
  const claim = pickClaim({
    message: text,
    userMessageNumber: chat.userMessageCount + 1,
    history: chat.claims,
  });

  const db = getDb();
  const prompt: PromptPayload = { messageId: newMessageId(), text };
  await db.insert(events).values({ attemptId: attempt.id, type: "prompt", payload: prompt });

  // The reply's id is created here and sent in the stream's first chunk, so
  // the id the browser shows is the id in the log — flags reference it.
  const messageId = newMessageId();

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start", messageId });

      const result = streamText({
        model: copilotModel(),
        instructions: buildInstructions(variant, claim),
        messages: toModelMessages(chat.messages, text),
        maxOutputTokens: COPILOT_MAX_OUTPUT_TOKENS,
        reasoning: "none", // short, fast replies; the cap above is for visible text
        onEnd: async ({ text: reply }) => {
          // Record the claim as shown only if it verifiably made it into the reply.
          const exposed = claim !== null && claimAppears(variant, claim, reply);
          const logged: AiResponsePayload = {
            messageId,
            text: reply,
            trapId: exposed ? claim : null,
            trapAttempted: claim,
            exposed,
          };
          await db.insert(events).values({ attemptId: attempt.id, type: "ai_response", payload: logged });
        },
        onError: ({ error }) => {
          console.error("copilot stream failed", { attemptId: attempt.id, error });
        },
      });

      // Finish generating (and logging) even if the browser disconnects mid-reply.
      result.consumeStream();
      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false }));
    },
    onError: () => "The copilot hit a problem. Try sending that again.",
  });

  return createUIMessageStreamResponse({ stream });
}
