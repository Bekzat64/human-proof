import "server-only";
import { randomInt } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { ChatTurn, ClaimHistory } from "./copilot";
import { copilotOpener } from "./copilot";
import { getDb } from "./db";
import { attempts, events, type Attempt } from "./db/schema";
import type { AiResponsePayload, PromptPayload, ReplySource, SeededClaimId } from "./events/schema";
import { churnMealkit } from "./scenarios/churn-mealkit";
import { SIM_DURATION_MS } from "./sim-config";
import { buildVariant } from "./variant";

const MAX_SEED = 2 ** 31 - 1; // attempts.seed is a Postgres integer

export const newMessageId = () => `msg_${nanoid(16)}`;

/**
 * Start a simulation: a fresh attempt with a crypto-random seed, plus the
 * copilot's templated opening message (which carries T1) as its first event.
 */
export async function createSimAttempt(anonId: string): Promise<string> {
  const id = nanoid(12);
  const seed = randomInt(0, MAX_SEED);
  const opener: AiResponsePayload = {
    messageId: newMessageId(),
    text: copilotOpener(buildVariant(seed)),
    trapId: "T1",
    trapAttempted: "T1",
    exposed: true,
    source: "template",
  };

  const db = getDb();
  await db.batch([
    db.insert(attempts).values({ id, anonId, kind: "sim", scenarioId: churnMealkit.id, seed }),
    db.insert(events).values({ attemptId: id, type: "ai_response", payload: opener }),
  ]);
  return id;
}

export async function getAttempt(id: string): Promise<Attempt | null> {
  const [row] = await getDb().select().from(attempts).where(eq(attempts.id, id)).limit(1);
  return row ?? null;
}

/** The attempt, only if it exists, is a simulation and belongs to this visitor. */
export async function getOwnedSimAttempt(id: string, anonId: string | null): Promise<Attempt | null> {
  const attempt = await getAttempt(id);
  if (!attempt || attempt.kind !== "sim" || !anonId || attempt.anonId !== anonId) return null;
  return attempt;
}

/** Time left on the attempt's clock right now, by the server's clock. Negative once over time. */
export function remainingMs(attempt: Pick<Attempt, "startedAt">): number {
  return attempt.startedAt.getTime() + SIM_DURATION_MS - Date.now();
}

export type ChatMessage = ChatTurn & { id: string; source?: ReplySource };

export type ChatState = {
  /** The conversation so far, oldest first. */
  messages: ChatMessage[];
  /** Copilot message id → the candidate's flag note. */
  flags: Record<string, string>;
  userMessageCount: number;
  claims: ClaimHistory;
};

/**
 * Rebuild the copilot conversation from the events table. This is the source
 * of truth for the chat: the page hydrates from it after a reload, and the
 * copilot route reads history and claim state from it rather than trusting
 * anything the browser sends.
 */
export async function loadChat(attemptId: string): Promise<ChatState> {
  const rows = await getDb()
    .select({ type: events.type, payload: events.payload })
    .from(events)
    .where(and(eq(events.attemptId, attemptId), inArray(events.type, ["prompt", "ai_response", "flag"])))
    .orderBy(asc(events.id));

  const messages: ChatMessage[] = [];
  const flags: Record<string, string> = {};
  const shown = new Set<SeededClaimId>();
  const tries: Partial<Record<SeededClaimId, number>> = {};
  let userMessageCount = 0;

  for (const row of rows) {
    if (row.type === "prompt") {
      const { messageId, text } = row.payload as PromptPayload;
      messages.push({ id: messageId, role: "user", text });
      userMessageCount++;
    } else if (row.type === "ai_response") {
      const reply = row.payload as AiResponsePayload;
      messages.push({ id: reply.messageId, role: "assistant", text: reply.text, source: reply.source });
      if (reply.trapAttempted) tries[reply.trapAttempted] = (tries[reply.trapAttempted] ?? 0) + 1;
      if (reply.trapId) shown.add(reply.trapId);
    } else {
      const { messageId, note } = row.payload as { messageId: string; note: string };
      flags[messageId] = note;
    }
  }

  return { messages, flags, userMessageCount, claims: { shown, tries } };
}
