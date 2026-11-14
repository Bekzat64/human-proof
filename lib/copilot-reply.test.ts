import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claimSentence, pickClaim } from "./copilot";
import { writeCopilotReply } from "./copilot-reply";
import { buildVariant } from "./variant";

const KEYS = ["ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "OPENAI_API_KEY"] as const;

describe("writeCopilotReply (the copilot route's reply, without a model)", () => {
  const saved: Partial<Record<(typeof KEYS)[number], string>> = {};
  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const key of KEYS) if (saved[key] !== undefined) process.env[key] = saved[key];
  });

  const variant = buildVariant(424242);

  it("T2: streams the fixed sentence as the very first chunk, then the offline answer in a new paragraph", async () => {
    const chunks: string[] = [];
    const result = await writeCopilotReply({
      variant,
      claim: "T2",
      message: "Is this normal for the industry?",
      history: [],
      emit: (delta) => chunks.push(delta),
    });
    expect(chunks[0]).toBe(claimSentence(variant, "T2"));
    expect(chunks[1]).toMatch(/^\n\nHere is how September compares/);
    expect(result).toMatchObject({ source: "offline", opening: claimSentence(variant, "T2"), firstModelTokenMs: null });
    expect(result.reply).toBe(chunks.join(""));
  });

  it("T3 offline: the claim and nothing else, so the same reply does not expose it", async () => {
    const chunks: string[] = [];
    const result = await writeCopilotReply({
      variant,
      claim: "T3",
      message: "Which channel drove the increase?",
      history: [],
      emit: (delta) => chunks.push(delta),
    });
    expect(chunks).toEqual([claimSentence(variant, "T3")]);
    expect(result.reply).toBe(claimSentence(variant, "T3"));
    expect(result.reply).not.toMatch(/churn rate by channel|→/i);
  });

  it("after T3 was shown, a precise follow-up gets the true per-channel rates", async () => {
    const message = "What is the churn rate by channel, August to September?";
    // T3 is already shown, so the server picks no claim for this turn.
    const claim = pickClaim({ message, userMessageNumber: 2, history: { shown: new Set(["T1", "T3"]) } });
    expect(claim).toBeNull();
    const chunks: string[] = [];
    await writeCopilotReply({ variant, claim, message, history: [], emit: (d) => chunks.push(d) });
    const driver = variant.groundTruth.channels.find((c) => c.channel === variant.groundTruth.drivingChannel)!;
    expect(chunks.join("")).toMatch(/^Churn rate by channel, August to September/);
    expect(chunks.join("")).toContain(`${driver.channel} ${driver.augChurnRate.toFixed(2)}% → ${driver.sepChurnRate.toFixed(2)}%`);
  });

  it("a reply with no claim due has no opening sentence", async () => {
    const chunks: string[] = [];
    const result = await writeCopilotReply({ variant, claim: null, message: "cancellations by channel?", history: [], emit: (d) => chunks.push(d) });
    expect(result.opening).toBeNull();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).not.toContain(variant.traps.T2.wrongClaim);
    expect(chunks[0]).not.toContain(variant.traps.T3.wrongClaim);
  });
});
