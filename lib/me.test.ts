import { describe, expect, it } from "vitest";
import { checkinSchema } from "./checkin";
import type { DrillScore } from "./drill/types";
import { drillAccuracy, nextStep, type SimPoint } from "./me";

const sim = (ratios: Partial<SimPoint["ratios"]>): SimPoint => ({
  id: Math.random().toString(36),
  date: new Date(),
  ratios: { correctness: 1, aiJudgment: 1, reasoning: 1, process: 1, ...ratios },
});
const noDrills = drillAccuracy([]);

describe("/me next step", () => {
  it("a newcomer gets both starting points", () => {
    expect(nextStep({ sims: [], drillDoneToday: false, accuracy: noDrills }).kind).toBe("start");
    expect(nextStep({ sims: [], drillDoneToday: true, accuracy: noDrills }).kind).toBe("sim");
  });

  it("weak AI judgment or correctness points to today's drill, unless it is done", () => {
    const sims = [sim({ aiJudgment: 0.2 }), sim({ aiJudgment: 0.4 })];
    const step = nextStep({ sims, drillDoneToday: false, accuracy: noDrills });
    expect(step.kind).toBe("drill");
    expect(step.reason).toContain("catching AI mistakes (30%)");
    expect(nextStep({ sims, drillDoneToday: true, accuracy: noDrills }).kind).toBe("sim");
  });

  it("weak reasoning or process points to another simulation; unassessed dimensions are ignored", () => {
    expect(nextStep({ sims: [sim({ reasoning: 0.3 })], drillDoneToday: false, accuracy: noDrills }).kind).toBe("sim");
    expect(nextStep({ sims: [sim({ aiJudgment: null, process: 0.5 })], drillDoneToday: false, accuracy: noDrills }).reason).toContain("working process");
  });

  it("names the weakest drill error type when there is drill history", () => {
    const item = (truthReason: DrillScore["items"][number]["truthReason"], sentenceCorrect: boolean) =>
      ({ truthReason, sentenceCorrect }) as DrillScore["items"][number];
    const accuracy = drillAccuracy([
      { items: [item("wrong_math", true), item("fabricated_source", false), item("wrong_conclusion", true), item("none", true)] } as DrillScore,
    ]);
    expect(accuracy.fabricated_source).toEqual({ seen: 1, spotted: 0 });
    const step = nextStep({ sims: [sim({ correctness: 0.1 })], drillDoneToday: false, accuracy });
    expect(step.reason).toContain("fabricated source");
  });
});

describe("check-in input", () => {
  it("accepts the two questions with a yes/no answer only", () => {
    expect(checkinSchema.safeParse({ attemptId: "a", question: "shared_proof", answer: true }).success).toBe(true);
    expect(checkinSchema.safeParse({ attemptId: "a", question: "got_interview", answer: false }).success).toBe(true);
    expect(checkinSchema.safeParse({ attemptId: "a", question: "salary", answer: true }).success).toBe(false);
    expect(checkinSchema.safeParse({ attemptId: "a", question: "shared_proof", answer: "yes" }).success).toBe(false);
  });
});
