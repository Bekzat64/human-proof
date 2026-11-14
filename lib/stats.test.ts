import { describe, expect, it } from "vitest";
import type { DrillScore } from "./drill/types";
import type { Score } from "./grading/types";
import { computeStats, isQaAnon, qaAnonIdsFromEnv } from "./stats";

const trap = (id: string, exposed: boolean, outcome: string) => ({ id, exposed, outcome });
const sim = (total: number, traps: ReturnType<typeof trap>[], aiMax = 30): Score =>
  ({
    total,
    traps,
    dimensions: {
      correctness: { score: 35, max: 35 },
      aiJudgment: { score: aiMax ? 15 : 0, max: aiMax },
      reasoning: { score: 20, max: 25 },
      process: { score: 5, max: 10 },
    },
  }) as unknown as Score;

describe("/stats", () => {
  it("is empty and honest with no rows", () => {
    const stats = computeStats({ sims: [], drills: [], verdicts: [] });
    expect(stats.sims).toMatchObject({ n: 0, withExposed: 0, mostMissed: null, averageTotal: null });
    expect(stats.sims.dimensions.correctness).toEqual({ avg: null, n: 0 });
    expect(stats.employer).toEqual({ n: 0, wouldInterview: 0 });
  });

  it("counts misses only among exposed errors and picks the most-missed by rate", () => {
    const stats = computeStats({
      sims: [
        sim(80, [trap("T1", true, "caught_by_answer"), trap("T2", true, "missed"), trap("T3", false, "not_shown")]),
        sim(60, [trap("T1", true, "missed"), trap("T2", true, "missed"), trap("T3", true, "caught_by_flag")]),
        sim(90, [trap("T1", false, "not_shown"), trap("T2", false, "not_shown"), trap("T3", false, "not_shown")], 0),
      ],
      drills: [],
      verdicts: ["would_interview", "not_yet", "would_interview"],
    });
    expect(stats.sims).toMatchObject({ n: 3, withExposed: 2, missedAtLeastOne: 2 });
    expect(stats.sims.mostMissed).toEqual({ id: "T2", missed: 2, shown: 2 });
    // AI judgment not assessed in the third sim, so it averages over two.
    expect(stats.sims.dimensions.aiJudgment).toEqual({ avg: 0.5, n: 2 });
    expect(stats.sims.dimensions.correctness).toEqual({ avg: 1, n: 3 });
    expect(stats.employer).toEqual({ n: 3, wouldInterview: 2 });
  });

  it("aggregates drill accuracy by the true error type", () => {
    const item = (truthReason: string, sentenceCorrect: boolean) => ({ truthReason, sentenceCorrect });
    const drill = { items: [item("wrong_math", true), item("wrong_math", false), item("none", true)] } as unknown as DrillScore;
    const stats = computeStats({ sims: [], drills: [drill], verdicts: [] });
    expect(stats.drills.byReason.wrong_math).toEqual({ seen: 2, spotted: 1 });
    expect(stats.drills.byReason.none).toEqual({ seen: 1, spotted: 1 });
  });

  it("excludes our own testing identities", () => {
    const extra = qaAnonIdsFromEnv(" abc , def,,");
    expect(extra).toEqual(new Set(["abc", "def"]));
    expect(isQaAnon("qa-owner", extra)).toBe(true);
    expect(isQaAnon("abc", extra)).toBe(true);
    expect(isQaAnon(null, extra)).toBe(true);
    expect(isQaAnon("realVisitor123", extra)).toBe(false);
  });
});
