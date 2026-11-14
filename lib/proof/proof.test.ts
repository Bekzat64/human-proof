import { describe, expect, it } from "vitest";
import type { Answer } from "../answers";
import { feedbackSchema } from "../feedback-schema";
import { scoreAttempt } from "../grading/score";
import type { LoggedEvent } from "../integrity";
import { buildVariant } from "../variant";
import { employerBullets, verdictLine } from "./employer";
import { linkedInAddUrl, resumeLine, validUntil } from "./share";
import { buildTimeline, formatClock } from "./timeline";

const start = new Date("2026-11-14T12:00:00Z");
const at = (sec: number) => new Date(start.getTime() + sec * 1000);
const event = (sec: number, type: string, payload: unknown): LoggedEvent => ({ type, ts: at(sec), payload });
const reply = (sec: number, messageId: string, trapId: "T1" | "T2" | "T3" | null) =>
  event(sec, "ai_response", { messageId, text: `reply ${messageId}`, trapId, trapAttempted: trapId, exposed: !!trapId, source: "offline" });

const log: LoggedEvent[] = [
  reply(0, "m1", "T1"),
  event(1, "data_view", { action: "view" }),
  event(20, "data_view", { action: "sort", column: "cancellations", direction: "desc" }),
  event(40, "prompt", { messageId: "u1", text: "is this normal?" }),
  reply(41, "m2", "T2"),
  event(70, "flag", { messageId: "m2", note: "no such report" }),
  event(90, "paste", { target: "q3", chars: 640 }),
  event(100, "blur", {}),
  event(160, "focus", { awayMs: 60_000 }),
  event(170, "focus", { awayMs: 800 }),
  event(175, "answer_edit", { field: "q3", chars: 700 }),
  event(200, "prompt", { messageId: "u2", text: "thanks" }),
  reply(201, "m3", null),
  event(210, "flag", { messageId: "m3", note: "looks off" }),
  event(600, "submit", { elapsedSec: 600, overtimeSec: 0 }),
];

describe("process replay timeline", () => {
  const timeline = buildTimeline(log, start);

  it("keeps prompts, replies, flags, pastes, tab-away periods and the submit, in clock order", () => {
    expect(timeline.map((i) => `${formatClock(i.atSec)} ${i.kind}`)).toEqual([
      "00:00 ai",
      "00:40 prompt",
      "00:41 ai",
      "01:10 flag",
      "01:30 paste",
      "01:40 away", // placed where the absence began
      "03:20 prompt",
      "03:21 ai",
      "03:30 flag",
      "10:00 submit",
    ]);
  });

  it("highlights replies that carried a seeded mistake, and says whether a flag was right", () => {
    expect(timeline.filter((i) => i.kind === "ai").map((i) => i.trapId)).toEqual(["T1", "T2", undefined]);
    const [right, wrong] = timeline.filter((i) => i.kind === "flag");
    expect(right.title).toContain("it was");
    expect(wrong.title).toContain("the reply was correct");
  });

  it("a paste shows its size and target, never content; short tab switches are dropped", () => {
    const paste = timeline.find((i) => i.kind === "paste")!;
    expect(paste.title).toBe("Pasted 640 characters into the recommendation");
    expect(paste.text).toBeUndefined();
    expect(timeline.filter((i) => i.kind === "away")).toHaveLength(1);
    expect(timeline.find((i) => i.kind === "away")!.title).toBe("Away from the tab for 1m 0s");
  });
});

describe("sharing", () => {
  const issued = new Date("2026-11-14T18:30:00Z");

  it("a proof is valid for 12 months", () => {
    expect(validUntil(issued).toISOString().slice(0, 10)).toBe("2027-11-14");
  });

  it("the LinkedIn link carries the proof URL as certUrl and the attempt id as certId", () => {
    const url = new URL(linkedInAddUrl({ level: "Advanced", certUrl: "https://hp.test/p/abc123", certId: "abc123", issued }));
    expect(`${url.origin}${url.pathname}`).toBe("https://www.linkedin.com/profile/add");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      startTask: "CERTIFICATION_NAME",
      name: "HUMAN PROOF — AI-assisted Analysis: Advanced",
      organizationName: "HUMAN PROOF",
      issueYear: "2026",
      issueMonth: "11",
      expirationYear: "2027",
      expirationMonth: "11",
      certUrl: "https://hp.test/p/abc123",
      certId: "abc123",
    });
  });

  it("the resume line claims a percentile only when there is one", () => {
    const base = { level: "Advanced" as const, total: 88, url: "https://hp.test/p/abc123" };
    expect(resumeLine({ ...base, percentile: 80 })).toBe(
      "HUMAN PROOF — AI-assisted Analysis: Advanced (top 20%), verify: https://hp.test/p/abc123",
    );
    expect(resumeLine({ ...base, percentile: null })).toBe(
      "HUMAN PROOF — AI-assisted Analysis: Advanced (88/100), verify: https://hp.test/p/abc123",
    );
  });
});

describe("employer view", () => {
  const variant = buildVariant(7);
  const truth = variant.groundTruth;
  const answer: Answer = {
    q1: truth.sepChurnRate,
    q2: truth.drivingChannel,
    q3: `Churn rose to ${truth.sepChurnRate}% and it comes from ${truth.drivingChannel}. Pause paid acquisition there and audit the promo cohort.`,
    q4: "Recomputed churn from start-of-month subscribers. Did not trust the industry benchmark: no source.",
  };
  const heuristic = scoreAttempt({ variant, answer, events: log });

  it("with a heuristic rubric the bullets come from deterministic results only and are marked estimated", () => {
    const { bullets, estimated } = employerBullets(heuristic);
    expect(estimated).toBe(true);
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toContain("Caught 2 of 2 seeded AI errors");
    expect(bullets[1]).toContain("correct");
    expect(bullets[2]).toContain("questioned the AI — yes");
    // Nothing from the unreviewed written rubric.
    expect(bullets.join(" ")).not.toContain(heuristic.dimensions.reasoning.strength);
  });

  it("with a model rubric the stored summary is used as is", () => {
    const criteria = { evidenceBased: 4, addressesCause: 4, actionable: 4, clearConcise: 4, statesVerification: 4 };
    const llm = scoreAttempt({ variant, answer, events: log }, { source: "llm", criteria, strength: "Names the right denominator.", gap: "No owner." });
    expect(employerBullets(llm)).toEqual({ bullets: llm.dimensions.reasoning.employerSummary, estimated: false });
  });

  it("the verdict line states level, score and errors caught", () => {
    expect(verdictLine(heuristic)).toMatch(new RegExp(`^${heuristic.level}, ${heuristic.total}/100 — caught 2 of 2 seeded AI errors\\.`));
  });
});

describe("feedback input", () => {
  it("accepts the two verdicts with an optional note, and nothing else", () => {
    expect(feedbackSchema.safeParse({ attemptId: "abc", verdict: "would_interview" }).success).toBe(true);
    expect(feedbackSchema.safeParse({ attemptId: "abc", verdict: "not_yet", note: " solid " }).data?.note).toBe("solid");
    expect(feedbackSchema.safeParse({ attemptId: "abc", verdict: "hire" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ attemptId: "abc", verdict: "not_yet", note: "x".repeat(501) }).success).toBe(false);
    expect(feedbackSchema.safeParse({ attemptId: "abc", verdict: "not_yet", anonId: "someone-else" }).success).toBe(false);
  });
});
