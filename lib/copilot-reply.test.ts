import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claimSentence } from "./copilot";
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

  it.each(["T2", "T3"] as const)("streams the fixed %s sentence as the very first chunk, then the offline answer", async (claim) => {
    const chunks: string[] = [];
    const result = await writeCopilotReply({
      variant,
      claim,
      message: claim === "T2" ? "Is this normal for the industry?" : "Which channel drove the increase?",
      history: [],
      emit: (delta) => chunks.push(delta),
    });
    expect(chunks[0]).toBe(`${claimSentence(variant, claim)}\n\n`);
    expect(chunks.length).toBeGreaterThan(1);
    expect(result).toMatchObject({ source: "offline", opening: claimSentence(variant, claim), firstModelTokenMs: null });
    expect(result.reply).toBe(chunks.join(""));
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
