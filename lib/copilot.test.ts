import { describe, expect, it } from "vitest";
import {
  buildInstructions,
  claimAppears,
  copilotOpener,
  pickClaim,
  toModelMessages,
  type ClaimHistory,
} from "./copilot";
import { formatCount } from "./format";
import { buildVariant } from "./variant";

const fresh: ClaimHistory = { shown: new Set(), tries: {} };
const pick = (message: string, userMessageNumber = 1, history: ClaimHistory = fresh) =>
  pickClaim({ message, userMessageNumber, history });

describe("pickClaim — which seeded claim goes into a reply", () => {
  it("brings in T2 on benchmark-style questions", () => {
    for (const message of [
      "Is this normal?",
      "How does that compare to the industry?",
      "what's a typical churn rate",
      "Any benchmark for this?",
      "is this bad",
    ]) {
      expect(pick(message), message).toBe("T2");
    }
  });

  it("brings in T3 on channel / cause questions", () => {
    for (const message of [
      "Which channel drove the increase?",
      "why did churn go up",
      "What is the main driver?",
      "what caused this",
    ]) {
      expect(pick(message), message).toBe("T3");
    }
  });

  it("leaves unrelated messages alone", () => {
    expect(pick("What were total cancellations in September?")).toBeNull();
    expect(pick("thanks", 2)).toBeNull();
  });

  it("forces T2 from the 3rd user message when nothing else fired", () => {
    expect(pick("total cancellations in August?", 2)).toBeNull();
    expect(pick("total cancellations in August?", 3)).toBe("T2");
    expect(pick("total cancellations in August?", 7)).toBe("T2");
  });

  it("a keyword match beats the forced T2, which then waits for the next message", () => {
    expect(pick("which channel is it?", 3)).toBe("T3");
  });

  it("puts at most one claim in a reply: whichever was asked about first", () => {
    expect(pick("Is this normal, and which channel caused it?")).toBe("T2");
    expect(pick("Which channel caused it, and is that normal?")).toBe("T3");
  });

  it("shows each claim at most once", () => {
    const afterT2: ClaimHistory = { shown: new Set(["T2"]), tries: { T2: 1 } };
    expect(pick("is this normal?", 4, afterT2)).toBeNull();
    expect(pick("which channel?", 4, afterT2)).toBe("T3");

    const afterBoth: ClaimHistory = { shown: new Set(["T2", "T3"]), tries: { T2: 1, T3: 1 } };
    expect(pick("is this normal? which channel?", 9, afterBoth)).toBeNull();
  });

  it("retries a claim that did not land once, then gives up", () => {
    expect(pick("is this normal?", 2, { shown: new Set(), tries: { T2: 1 } })).toBe("T2");
    expect(pick("is this normal?", 3, { shown: new Set(), tries: { T2: 2 } })).toBeNull();
  });
});

describe("claimAppears — server-side check that the claim really was made", () => {
  const variant = buildVariant(7);
  const { T2, T3 } = variant.traps;
  const decoyCancellations = variant.groundTruth.channels.find(
    (c) => c.channel === T3.trapValue,
  )!.sepCancellations;

  it("recognises the scripted sentences themselves", () => {
    expect(claimAppears(variant, "T2", T2.wrongClaim)).toBe(true);
    expect(claimAppears(variant, "T3", T3.wrongClaim)).toBe(true);
  });

  it("recognises a paraphrase that keeps the figure", () => {
    expect(
      claimAppears(variant, "T2", `Industry reports put average meal-kit churn at ${T2.trapValue} percent.`),
    ).toBe(true);
    expect(
      claimAppears(variant, "T3", `It's ${T3.trapValue}, with ${decoyCancellations} cancellations in September.`),
    ).toBe(true);
  });

  it("is not fooled by a reply that leaves the claim out", () => {
    expect(claimAppears(variant, "T2", "September churn was higher than August.")).toBe(false);
    expect(claimAppears(variant, "T2", `Churn was ${T2.trapValue}% in one channel.`)).toBe(false);
    expect(claimAppears(variant, "T3", `${T3.correctValue} had the largest rate increase.`)).toBe(false);
    expect(claimAppears(variant, "T3", `${T3.trapValue} is the largest channel.`)).toBe(false);
  });
});

describe("instructions", () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

  it('never contain the words "trap", "test" or "error"', () => {
    const banned = /\b(trap|traps|test|tests|testing|error|errors)\b/i;
    for (const seed of seeds) {
      const variant = buildVariant(seed);
      for (const claim of [null, "T2", "T3"] as const) {
        expect(buildInstructions(variant, claim)).not.toMatch(banned);
      }
      expect(copilotOpener(variant)).not.toMatch(banned);
    }
  });

  it("carry the scripted sentence only on the turn it is due", () => {
    const variant = buildVariant(7);
    expect(buildInstructions(variant, "T2")).toContain(variant.traps.T2.wrongClaim);
    expect(buildInstructions(variant, "T3")).toContain(variant.traps.T3.wrongClaim);
    const plain = buildInstructions(variant, null);
    expect(plain).not.toContain(variant.traps.T2.wrongClaim);
    expect(plain).not.toContain(variant.traps.T3.wrongClaim);
  });

  it("always give the model the correct aggregates, so precise questions get true answers", () => {
    for (const seed of seeds) {
      const variant = buildVariant(seed);
      const { sepChurnRate, sepTotals, drivingChannel } = variant.groundTruth;
      const instructions = buildInstructions(variant, null);
      expect(instructions).toContain(`${sepChurnRate.toFixed(2)}%`);
      expect(instructions).toContain(
        `${formatCount(sepTotals.cancellations)} ÷ ${formatCount(sepTotals.subsStart)}`,
      );
      expect(instructions).toContain(`Largest Aug to Sep churn-rate increase: ${drivingChannel}`);
    }
  });
});

describe("opener and conversation", () => {
  it("the opener carries T1 and mentions the September promo", () => {
    const variant = buildVariant(7);
    const opener = copilotOpener(variant);
    expect(opener).toContain(variant.traps.T1.wrongClaim);
    expect(opener).toMatch(/September .*promo/);
  });

  it("the model always sees a user turn first, then the history, then the new message", () => {
    const messages = toModelMessages(
      [
        { role: "assistant", text: "opener" },
        { role: "user", text: "hi" },
        { role: "assistant", text: "" }, // a reply that failed mid-stream is skipped
      ],
      "next question",
    );
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "user"]);
    expect(messages.at(-1)?.content).toBe("next question");
  });
});
