import { describe, expect, it } from "vitest";
import { DRILLS } from "../scenarios/drills";
import { dailyDrill, drillDateKey, previousDateKey, toPublicItem } from "./daily";
import { computeStreak, drillSubmitSchema, scoreDrill } from "./score";
import { DRILL_DOMAINS, DRILL_REASONS, type DrillAnswer } from "./types";

describe("drill bank", () => {
  it("has 15 items with unique ids, in valid shape", () => {
    expect(DRILLS).toHaveLength(15);
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(15);
    for (const item of DRILLS) {
      expect(DRILL_DOMAINS, item.id).toContain(item.domain);
      expect(DRILL_REASONS, item.id).toContain(item.reason);
      // 1–2 sentence context, small table, 3–5 sentence answer.
      expect(item.context.split(/(?<=[.?!])\s+/).length, item.id).toBeLessThanOrEqual(2);
      expect(item.table.rows.length, item.id).toBeGreaterThanOrEqual(2);
      expect(item.table.rows.length, item.id).toBeLessThanOrEqual(6);
      for (const row of item.table.rows) expect(row, item.id).toHaveLength(item.table.columns.length);
      expect(item.sentences.length, item.id).toBeGreaterThanOrEqual(3);
      expect(item.sentences.length, item.id).toBeLessThanOrEqual(5);
      for (const sentence of item.sentences) expect(sentence, item.id).toMatch(/[.!?]$/);
      expect(item.explanation.length, item.id).toBeGreaterThan(20);
    }
  });

  it("each item has exactly one wrong sentence, or none", () => {
    for (const item of DRILLS) {
      if (item.reason === "none") {
        expect(item.wrongIndex, item.id).toBeNull();
      } else {
        expect(Number.isInteger(item.wrongIndex), item.id).toBe(true);
        expect(item.wrongIndex, item.id).toBeGreaterThanOrEqual(0);
        expect(item.wrongIndex, item.id).toBeLessThan(item.sentences.length);
      }
    }
  });

  it("the reason mix is 5 math, 4 source, 4 conclusion, 2 nothing wrong, across all five domains", () => {
    const count = (reason: string) => DRILLS.filter((d) => d.reason === reason).length;
    expect(DRILL_REASONS.map(count)).toEqual([5, 4, 4, 2]);
    for (const domain of DRILL_DOMAINS) {
      expect(DRILLS.filter((d) => d.domain === domain).length, domain).toBeGreaterThanOrEqual(2);
    }
  });

  it("every wrong-math figure really is wrong when recomputed from the table", () => {
    const math = DRILLS.filter((d) => d.reason === "wrong_math");
    for (const item of math) {
      expect(item.check, item.id).toBeDefined();
      const { claimed, compute } = item.check!;
      const truth = compute(item.table.rows);
      expect(Number.isFinite(truth), item.id).toBe(true);
      // Wrong by a margin anyone can see, not a rounding quibble.
      expect(Math.abs(truth - claimed) / Math.abs(truth), item.id).toBeGreaterThan(0.2);
      // The stated figure is in the wrong sentence, and nowhere claimed as true in the explanation's fix.
      expect(item.sentences[item.wrongIndex!], item.id).toContain(String(claimed));
      const shown = Number.isInteger(truth) ? String(truth) : truth.toFixed(1);
      expect(item.explanation.replace(/about (\d+)%/, (_, d) => `${d}`), item.id).toMatch(
        new RegExp(`\\b${Math.round(truth)}\\b|${shown.replace(".", "\\.")}`),
      );
    }
  });

  it("fabricated sources cite something outside the table and never name a real organisation", () => {
    const sourceWords = /survey|study|report|research|benchmark|according to/i;
    const realNames =
      /gartner|mckinsey|forrester|nielsen|deloitte|hubspot|mailchimp|bain|bcg|harvard|statista|idc|zendesk|salesforce|google|pwc|kpmg|accenture|stanford|mit\b/i;
    for (const item of DRILLS) {
      item.sentences.forEach((sentence, i) => {
        expect(sentence, item.id).not.toMatch(realNames);
        const isFabricated = item.reason === "fabricated_source" && i === item.wrongIndex;
        // A source appears in exactly the fabricated sentence and nowhere else.
        expect(sourceWords.test(sentence), `${item.id} #${i}`).toBe(isFabricated);
      });
    }
  });

  it("the public form of an item carries no answer key", () => {
    for (const item of DRILLS) {
      const json = JSON.stringify(toPublicItem(item));
      expect(Object.keys(toPublicItem(item)).sort()).toEqual(["context", "domain", "id", "sentences", "table"]);
      expect(json).not.toContain(item.explanation);
      expect(json).not.toContain("wrongIndex");
    }
  });
});

describe("daily set", () => {
  it("is five distinct items, the same for everyone on a day and different across days", () => {
    const today = dailyDrill("2026-11-14");
    expect(today).toHaveLength(5);
    expect(new Set(today.map((d) => d.id)).size).toBe(5);
    expect(dailyDrill("2026-11-14").map((d) => d.id)).toEqual(today.map((d) => d.id));

    const days = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
    const sets = new Set(days.map((day) => dailyDrill(day).map((d) => d.id).join(",")));
    expect(sets.size).toBeGreaterThan(25);
    // Over a month every item gets used.
    expect(new Set(days.flatMap((day) => dailyDrill(day).map((d) => d.id))).size).toBe(15);
  });

  it("the day changes at midnight in New York, not UTC", () => {
    expect(drillDateKey(new Date("2026-11-15T03:30:00Z"))).toBe("2026-11-14"); // 22:30 EST
    expect(drillDateKey(new Date("2026-11-15T05:30:00Z"))).toBe("2026-11-15"); // 00:30 EST
    expect(drillDateKey(new Date("2026-07-01T03:59:00Z"))).toBe("2026-06-30"); // 23:59 EDT
    expect(previousDateKey("2026-03-01")).toBe("2026-02-28");
    expect(previousDateKey("2027-01-01")).toBe("2026-12-31");
  });
});

describe("drill scoring", () => {
  const items = dailyDrill("2026-11-14");
  const right = (): DrillAnswer[] =>
    items.map((item) => ({ itemId: item.id, sentence: item.wrongIndex ?? "none", reason: item.reason, ms: 20_000 }));
  const base = { date: "2026-11-14", items, elapsedMs: 100_000, countsForStreak: true, streak: 1 };

  it("all right is 100; sentence is worth 15 and reason 5", () => {
    const perfect = scoreDrill({ ...base, answers: right() });
    expect(perfect).toMatchObject({ total: 100, correct: 5, overtimeSec: 0, elapsedSec: 100 });

    const flawed = items.find((item) => item.wrongIndex !== null)!;
    const otherReason = DRILL_REASONS.find((r) => r !== flawed.reason && r !== "none")!;
    const wrongReason = right().map((a) => (a.itemId === flawed.id ? { ...a, reason: otherReason } : a));
    expect(scoreDrill({ ...base, answers: wrongReason }).total).toBe(95);

    const otherSentence = (flawed.wrongIndex! + 1) % flawed.sentences.length;
    const wrongSentence = right().map((a) => (a.itemId === flawed.id ? { ...a, sentence: otherSentence } : a));
    const scored = scoreDrill({ ...base, answers: wrongSentence });
    expect(scored.total).toBe(85); // reason still right: 5 of 20
    expect(scored.correct).toBe(4);
  });

  it("unanswered items and answers for items outside today's set score nothing", () => {
    expect(scoreDrill({ ...base, answers: [] })).toMatchObject({ total: 0, correct: 0 });
    const foreign = [{ itemId: "not-today", sentence: 0, reason: "wrong_math" as const, ms: 1 }];
    expect(scoreDrill({ ...base, answers: foreign }).total).toBe(0);
  });

  it('"nothing wrong" on a flawed item scores nothing, and overtime is recorded', () => {
    const allNone = items.map((item) => ({ itemId: item.id, sentence: "none" as const, reason: null, ms: 1 }));
    const scored = scoreDrill({ ...base, answers: allNone, elapsedMs: 200_000 });
    const clean = items.filter((item) => item.wrongIndex === null).length;
    expect(scored.total).toBe(clean * 20);
    expect(scored.overtimeSec).toBe(20);
  });

  it("the submit schema takes picks and timings only", () => {
    const ok = { attemptId: "a", answers: [{ itemId: "x", sentence: "none", reason: null, ms: 10 }] };
    expect(drillSubmitSchema.safeParse(ok).success).toBe(true);
    expect(drillSubmitSchema.safeParse({ ...ok, score: 100 }).success).toBe(false);
    expect(drillSubmitSchema.safeParse({ attemptId: "a", answers: Array(6).fill(ok.answers[0]) }).success).toBe(false);
    expect(drillSubmitSchema.safeParse({ attemptId: "a", answers: [{ ...ok.answers[0], reason: "typo" }] }).success).toBe(false);
  });
});

describe("streak", () => {
  const streak = (dates: string[], today: string) => computeStreak(dates, today, previousDateKey);

  it("counts consecutive days ending today; several drills in a day count once", () => {
    expect(streak([], "2026-11-14")).toBe(0);
    expect(streak(["2026-11-14"], "2026-11-14")).toBe(1);
    expect(streak(["2026-11-14", "2026-11-14", "2026-11-13", "2026-11-12"], "2026-11-14")).toBe(3);
  });

  it("stays alive through today until the day ends, and resets after a missed day", () => {
    expect(streak(["2026-11-13", "2026-11-12"], "2026-11-14")).toBe(2);
    expect(streak(["2026-11-12", "2026-11-11"], "2026-11-14")).toBe(0);
    expect(streak(["2026-11-14", "2026-11-12"], "2026-11-14")).toBe(1);
  });
});
