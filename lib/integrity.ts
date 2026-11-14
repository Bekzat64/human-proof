import type { AiResponsePayload, SubmitPayload } from "./events/schema";

/** An event row as grading sees it. */
export type LoggedEvent = { type: string; ts: Date; payload: unknown };

const duration = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
};

/**
 * Observations about HOW the attempt was done, derived from process capture.
 * They are shown on the Proof page next to the score; they never change the
 * score and never fail an attempt on their own.
 */
export function integrityNotes(events: readonly LoggedEvent[]): string[] {
  const notes: string[] = [];
  const of = <T>(type: string) => events.filter((e) => e.type === type).map((e) => e.payload as T);

  // Pasting a long answer before touching the data or the copilot.
  const firstWork = events.findIndex(
    (e) =>
      e.type === "prompt" ||
      (e.type === "data_view" && (e.payload as { action: string }).action !== "view"),
  );
  const early = firstWork === -1 ? events : events.slice(0, firstWork);
  const earlyPaste = early
    .filter((e) => e.type === "paste")
    .map((e) => e.payload as { target: string; chars: number })
    .filter((p) => p.target !== "copilot")
    .reduce((total, p) => total + p.chars, 0);
  if (earlyPaste >= 500) {
    notes.push(`Pasted ${earlyPaste} characters into the answers before using the data or the copilot.`);
  }

  const awayMs = of<{ awayMs: number }>("focus").reduce((total, p) => total + p.awayMs, 0);
  if (awayMs >= 30_000) notes.push(`Away from the tab for ${duration(awayMs)} in total.`);

  const submit = of<SubmitPayload>("submit")[0];
  if (submit) {
    if (submit.elapsedSec < 120) notes.push(`Submitted in under 2 minutes (${duration(submit.elapsedSec * 1000)}).`);
    if (submit.overtimeSec > 0) notes.push(`Submitted ${duration(submit.overtimeSec * 1000)} over the 15-minute limit.`);
  }

  if (of("flag").length === 0) notes.push("No AI response was flagged as wrong.");

  if (of<AiResponsePayload>("ai_response").some((r) => r.source === "offline")) {
    notes.push("The copilot ran in offline mode (scripted replies, no AI model) for this attempt.");
  }

  return notes;
}
