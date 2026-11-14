/**
 * pnpm llm:check
 *
 * The LLM switch-on checklist, as one command. With the configured provider
 * it runs the copilot exactly as /api/copilot does (writeCopilotReply) for a
 * T2 and a T3 turn, and the grader rubric once, then prints model IDs,
 * latency, and whether each seeded sentence streamed first.
 *
 * No key set: prints that and exits 0 (offline mode is a valid state).
 * Exit 1 if any check fails, so it can gate a deploy.
 *
 * Switch-on steps (README "Offline copilot vs LLM mode"):
 *   1. Set LLM_PROVIDER and its key in Vercel (Production + Preview) and .env.local
 *   2. pnpm llm:check            ← this script, must print "all checks passed"
 *   3. vercel deploy --prod
 *   4. pnpm regrade --heuristic-only
 *   5. Open a new proof: the "estimated" tag is gone, replies no longer say "Offline copilot"
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the environment
}

const KEY_ENV = { anthropic: "ANTHROPIC_API_KEY", google: "GOOGLE_GENERATIVE_AI_API_KEY", openai: "OPENAI_API_KEY" } as const;
/** Words that must never reach a candidate (they would give the exercise away). */
const GIVEAWAY = /\b(trap|test(ing)?|seeded|scripted|instruction|deliberate(ly)?|planted)\b/i;

async function main() {
  const { isLlmAvailable, llmProvider, modelId } = await import("../lib/llm");
  const provider = llmProvider();

  if (!isLlmAvailable()) {
    console.log(`no key: LLM_PROVIDER=${provider} but ${KEY_ENV[provider]} is not set.`);
    console.log("The app stays in offline mode (offline copilot, estimated rubric). Nothing to check.");
    return 0;
  }

  const { buildVariant } = await import("../lib/variant");
  const { pickClaim, copilotOpener } = await import("../lib/copilot");
  const { writeCopilotReply } = await import("../lib/copilot-reply");
  const { llmRubric } = await import("../lib/grading/llm");

  console.log(`provider ${provider}`);
  console.log(`  copilot model  ${modelId("copilot")}`);
  console.log(`  grader model   ${modelId("grader")}\n`);

  const variant = buildVariant(424242);
  const history: { role: "user" | "assistant"; text: string }[] = [{ role: "assistant", text: copilotOpener(variant) }];
  let failures = 0;
  const check = (ok: boolean, label: string) => {
    if (!ok) failures++;
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  };

  const turns = [
    { expect: "T2" as const, message: "Is this normal compared to the industry?", number: 1 },
    { expect: "T3" as const, message: "Which channel drove the increase?", number: 2 },
  ];
  for (const turn of turns) {
    const claim = pickClaim({ message: turn.message, userMessageNumber: turn.number, history: { shown: new Set(["T1"]) } });
    const chunks: string[] = [];
    const errors: unknown[] = [];
    const result = await writeCopilotReply({
      variant,
      claim,
      message: turn.message,
      history,
      emit: (delta) => chunks.push(delta),
      onModelError: (error) => errors.push(error),
    });
    const continuation = result.reply.slice(result.opening?.length ?? 0).trim();

    console.log(`copilot ${turn.expect}: "${turn.message}"`);
    check(claim === turn.expect, `server picked ${claim ?? "no claim"} (expected ${turn.expect})`);
    check(chunks[0] === result.opening, "seeded sentence streamed first, word for word, as its own chunk");
    check(result.source === "llm", `model answered (source: ${result.source}${errors.length ? `, error: ${String(errors[0]).slice(0, 120)}` : ""})`);
    check(continuation.length > 0 && !continuation.includes(result.opening ?? "\u0000"), "model continued without repeating the sentence");
    check(!GIVEAWAY.test(continuation), "no giveaway words in the continuation");
    console.log(`    first model token ${result.firstModelTokenMs ?? "—"} ms · total ${result.totalMs} ms`);
    console.log(`    continuation: ${continuation.slice(0, 220).replace(/\s+/g, " ")}${continuation.length > 220 ? "…" : ""}\n`);
    history.push({ role: "user", text: turn.message }, { role: "assistant", text: result.reply });
  }

  const truth = variant.groundTruth;
  const started = performance.now();
  const rubric = await llmRubric(variant, {
    q1: Math.round(truth.sepChurnRate * 100) / 100,
    q2: truth.drivingChannel,
    q3: `Churn rose to ${truth.sepChurnRate.toFixed(2)}%, driven by ${truth.drivingChannel}. Pause that promo, audit the September cohort and fix onboarding before the next campaign.`,
    q4: "Recomputed churn from start-of-month subscribers. Did not trust the industry report: no source.",
  });
  console.log("grader rubric:");
  check(rubric !== null, rubric ? "model returned a valid rubric" : "grader failed; proofs would fall back to the estimated rubric");
  console.log(`    latency ${Math.round(performance.now() - started)} ms`);
  if (rubric) {
    console.log(`    criteria ${Object.entries(rubric.criteria).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    console.log(`    strength: ${rubric.strength}`);
    console.log(`    gap: ${rubric.gap}`);
  }

  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
  return failures === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
