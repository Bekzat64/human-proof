import { and, eq } from "drizzle-orm";
import { getAnonId } from "@/lib/anon";
import { jsonError, readJson } from "@/lib/api";
import { getOwnedSimAttempt } from "@/lib/attempts";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eventBatchSchema, type AiResponsePayload } from "@/lib/events/schema";
import { MAX_EVENTS_PER_BATCH } from "@/lib/sim-config";

/**
 * Batched process-capture events from the browser (see lib/events/schema.ts
 * for what may be sent). Only the attempt's owner can write, and only while
 * the attempt is still active.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = eventBatchSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError("invalid_input", `Send 1–${MAX_EVENTS_PER_BATCH} valid events per batch.`);
  }
  const { attemptId, events: batch } = parsed.data;

  const attempt = await getOwnedSimAttempt(attemptId, await getAnonId());
  if (!attempt) return jsonError("not_found", "This simulation does not exist.");
  if (attempt.status !== "active") {
    return jsonError("not_active", "This simulation has already been submitted.");
  }

  const db = getDb();

  // A flag must point at a copilot message that exists in this attempt.
  let accepted = batch;
  if (batch.some((e) => e.type === "flag")) {
    const replies = await db
      .select({ payload: events.payload })
      .from(events)
      .where(and(eq(events.attemptId, attempt.id), eq(events.type, "ai_response")));
    const replyIds = new Set(replies.map((r) => (r.payload as AiResponsePayload).messageId));
    accepted = batch.filter((e) => e.type !== "flag" || replyIds.has(e.payload.messageId));
  }

  if (accepted.length > 0) {
    // Client clocks are only trusted inside the attempt's own time window.
    const earliest = attempt.startedAt.getTime();
    const now = Date.now();
    await db.insert(events).values(
      accepted.map((e) => ({
        attemptId: attempt.id,
        type: e.type,
        ts: new Date(e.at >= earliest && e.at <= now ? e.at : now),
        payload: e.payload,
      })),
    );
  }

  return Response.json(
    { ok: true, accepted: accepted.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
