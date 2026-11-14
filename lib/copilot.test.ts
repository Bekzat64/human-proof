import { describe, expect, it } from "vitest";
import {
  buildInstructions,
  claimSentence,
  copilotOpener,
  pickClaim,
  toModelMessages,
  type ClaimHistory,
} from "./copilot";
import { offlineReply } from "./copilot-offline";
import { formatCount, formatPct } from "./format";
import { buildVariant } from "./variant";

const fresh: ClaimHistory = { shown: new Set() };
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
    const afterT2: ClaimHistory = { shown: new Set(["T2"]) };
    expect(pick("is this normal?", 4, afterT2)).toBeNull();
    expect(pick("which channel?", 4, afterT2)).toBe("T3");

    const afterBoth: ClaimHistory = { shown: new Set(["T2", "T3"]) };
    expect(pick("is this normal? which channel?", 9, afterBoth)).toBeNull();
  });

});

describe("seeded claims are fixed text", () => {
  const variant = buildVariant(7);

  it("the sentence that opens a T2 / T3 reply is the scripted claim, word for word", () => {
    expect(claimSentence(variant, "T2")).toBe(variant.traps.T2.wrongClaim);
    expect(claimSentence(variant, "T3")).toBe(variant.traps.T3.wrongClaim);
    expect(claimSentence(variant, "T2")).toContain(`${variant.traps.T2.trapValue}%`);
    expect(claimSentence(variant, "T3")).toContain(variant.traps.T3.trapValue);
  });

  it("the offline copilot never writes a claim itself: the route puts it first for both copilots", () => {
    for (const message of ["is this normal?", "which channel drove it?", "hello"]) {
      const reply = offlineReply(variant, message);
      expect(reply).not.toContain(variant.traps.T2.wrongClaim);
      expect(reply).not.toContain(variant.traps.T3.wrongClaim);
    }
  });
});

describe("instructions", () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

  it('never contain the words "trap", "test" or "error"', () => {
    const banned = /\b(trap|traps|test|tests|testing|error|errors)\b/i;
    for (const seed of seeds) {
      const variant = buildVariant(seed);
      for (const opening of [null, claimSentence(variant, "T2"), claimSentence(variant, "T3")]) {
        expect(buildInstructions(variant.publicData, opening)).not.toMatch(banned);
      }
      expect(copilotOpener(variant)).not.toMatch(banned);
    }
  });

  it("tell the model about the fixed opening only on the turn it is used", () => {
    const variant = buildVariant(7);
    const opening = claimSentence(variant, "T3");
    expect(buildInstructions(variant.publicData, opening)).toContain(opening);
    const plain = buildInstructions(variant.publicData, null);
    expect(plain).not.toContain(variant.traps.T2.wrongClaim);
    expect(plain).not.toContain(variant.traps.T3.wrongClaim);
  });

  it("contain the table and nothing from the answer key", () => {
    for (const seed of seeds) {
      const variant = buildVariant(seed);
      const { groundTruth: truth, traps, publicData } = variant;
      // Built from publicData alone: the answer key is not even passed in.
      const instructions = buildInstructions(publicData, null);

      // Every row of the visible table is there.
      for (const row of publicData.dataset) {
        expect(instructions).toContain(`cancellations ${formatCount(row.cancellations)}, subs_end ${formatCount(row.subs_end)}`);
      }

      // No conclusions: no all-channel rate (the totals lines carry counts
      // only), no worked September division, no month-to-month change, no
      // baseline, no ranking of channels, no correct value of any seeded claim.
      const totals = instructions.split("\n").filter((line) => /^[A-Z][a-z]{2} \d{4}: subs_start/.test(line));
      expect(totals).toHaveLength(publicData.months.length);
      for (const line of totals) expect(line).not.toContain("%");

      const { cancellations, subsStart } = truth.sepTotals;
      expect(instructions).not.toContain(`${formatCount(cancellations)} ÷ ${formatCount(subsStart)}`);
      expect(instructions).not.toMatch(/\d\s?pp\b/); // churnIncreasePp, per-channel changes
      expect(instructions).not.toMatch(/largest|highest|biggest|drove|driving|baseline|pooled|key facts/i);
      expect(instructions).not.toContain(`${formatPct(truth.sepChurnRate, 2)}% (`);
      for (const id of ["T1", "T2", "T3"] as const) {
        expect(instructions).not.toContain(traps[id].explanation);
        expect(instructions).not.toContain(traps[id].wrongClaim);
      }
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
