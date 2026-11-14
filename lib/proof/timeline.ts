import type { AiResponsePayload, PromptPayload, SeededClaimId } from "../events/schema";
import type { LoggedEvent } from "../integrity";

/**
 * The process replay shown on the Proof page: what happened during the
 * attempt, in order, with a clock relative to its start. Pure, so it can be
 * tested and so the page decides separately how much of it to show.
 */

export type TimelineKind = "ai" | "prompt" | "flag" | "paste" | "away" | "submit";

export type TimelineItem = {
  /** Seconds since the attempt started. */
  atSec: number;
  kind: TimelineKind;
  title: string;
  /** What was said (prompts, copilot replies, flag notes). Never pasted content. */
  text?: string;
  /** Set on a copilot reply that carried a seeded mistake. */
  trapId?: SeededClaimId;
  /** Small label next to the title. */
  tag?: string;
};

const PASTE_TARGETS: Record<string, string> = {
  q1: "the churn-rate answer",
  q2: "the channel answer",
  q3: "the recommendation",
  q4: "the verification notes",
  copilot: "the copilot chat",
};

/** Shorter tab switches are noise (a glance at a notification). */
const MIN_AWAY_MS = 3000;

export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;
}

export function buildTimeline(events: readonly LoggedEvent[], startedAt: Date): TimelineItem[] {
  const start = startedAt.getTime();
  const at = (ts: Date, backMs = 0) => Math.max(0, (ts.getTime() - backMs - start) / 1000);

  const replies = new Map<string, AiResponsePayload>();
  for (const e of events) {
    if (e.type !== "ai_response") continue;
    const reply = e.payload as AiResponsePayload;
    replies.set(reply.messageId, reply);
  }

  const items: TimelineItem[] = [];
  for (const e of events) {
    switch (e.type) {
      case "ai_response": {
        const reply = e.payload as AiResponsePayload;
        items.push({
          atSec: at(e.ts),
          kind: "ai",
          title: reply.trapId ? "Copilot replied — with a seeded mistake" : "Copilot replied",
          text: reply.text,
          trapId: reply.trapId ?? undefined,
          tag: reply.source === "offline" ? "offline copilot" : undefined,
        });
        break;
      }
      case "prompt":
        items.push({ atSec: at(e.ts), kind: "prompt", title: "Asked the copilot", text: (e.payload as PromptPayload).text });
        break;
      case "flag": {
        const { messageId, note } = e.payload as { messageId: string; note: string };
        const flaggedReply = replies.get(messageId);
        const claim = flaggedReply?.trapId;
        items.push({
          atSec: at(e.ts),
          kind: "flag",
          // Only an offline reply is known to be correct; a model-written one is not judged.
          title: claim
            ? "Flagged a copilot reply as wrong — it was"
            : flaggedReply?.source === "offline"
              ? "Flagged a copilot reply as wrong — the reply was correct"
              : "Flagged a copilot reply as wrong",
          text: note,
          trapId: claim ?? undefined,
        });
        break;
      }
      case "paste": {
        const { target, chars } = e.payload as { target: string; chars: number };
        items.push({
          atSec: at(e.ts),
          kind: "paste",
          title: `Pasted ${chars.toLocaleString("en-US")} characters into ${PASTE_TARGETS[target] ?? "an answer"}`,
        });
        break;
      }
      case "focus": {
        const { awayMs } = e.payload as { awayMs: number };
        if (awayMs >= MIN_AWAY_MS) {
          // Placed where the absence began, not where it ended.
          items.push({ atSec: at(e.ts, awayMs), kind: "away", title: `Away from the tab for ${formatDuration(awayMs)}` });
        }
        break;
      }
      case "submit":
        items.push({ atSec: at(e.ts), kind: "submit", title: "Submitted the answers" });
        break;
    }
  }
  // Stable: events that share a second keep their logged order.
  return items.map((item, i) => ({ item, i })).sort((a, b) => a.item.atSec - b.item.atSec || a.i - b.i).map(({ item }) => item);
}
