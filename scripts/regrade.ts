/**
 * pnpm regrade --heuristic-only
 * pnpm regrade --all
 *
 * Attempts graded while no LLM key was configured carry a rule-based
 * ("heuristic") reasoning score. Once a key exists, this re-runs the model
 * rubric for exactly those attempts and stores the updated score. The
 * deterministic 75 points are recomputed from the same inputs, so they do
 * not move.
 *
 * --all re-scores every graded attempt with the current scoring rules (used
 * after a rule change, e.g. flag precision). It needs no key: a reasoning
 * rubric already scored by the model is kept as stored, and a heuristic one
 * is recomputed by rules, or by the model when a key exists.
 */
import { and, eq, sql } from "drizzle-orm";
import type { Score } from "../lib/grading/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the environment
}

async function main() {
  const all = process.argv.includes("--all");
  if (!all && !process.argv.includes("--heuristic-only")) {
    console.error("Usage: pnpm regrade --heuristic-only | --all");
    process.exit(1);
  }

  const { getDb } = await import("../lib/db");
  const { attempts } = await import("../lib/db/schema");
  const { loadScoringInput } = await import("../lib/grading/compose");
  const { llmRubric } = await import("../lib/grading/llm");
  const { scoreAttempt } = await import("../lib/grading/score");
  const { isLlmAvailable, llmProvider, modelId } = await import("../lib/llm");

  if (all) return regradeAll();

  if (!isLlmAvailable()) {
    console.error(`No API key for LLM_PROVIDER=${llmProvider()}. Nothing to do.`);
    process.exit(1);
  }

  async function regradeAll() {
    const db = getDb();
    const graded = await db.select().from(attempts).where(eq(attempts.status, "graded"));
    console.log(`${graded.length} graded attempt(s); model ${isLlmAvailable() ? `${llmProvider()}/${modelId("grader")}` : "not configured"}`);
    for (const attempt of graded) {
      const input = await loadScoringInput(attempt);
      if (!input) {
        console.log(`  ${attempt.id}: skipped (no valid answer)`);
        continue;
      }
      const stored = (attempt.score as Score | null)?.dimensions.reasoning;
      const rubric =
        stored?.source === "llm"
          ? { source: "llm" as const, criteria: stored.criteria, strength: stored.strength, gap: stored.gap }
          : isLlmAvailable()
            ? await llmRubric(input.variant, input.answer)
            : null;
      const score = scoreAttempt(input, rubric);
      await db.update(attempts).set({ score, total: score.total }).where(eq(attempts.id, attempt.id));
      console.log(`  ${attempt.id}: ${attempt.total} → ${score.total} (${score.level})`);
    }
    console.log("Done.");
  }

  const db = getDb();
  const pending = await db
    .select()
    .from(attempts)
    .where(
      and(
        eq(attempts.status, "graded"),
        sql`${attempts.score} -> 'dimensions' -> 'reasoning' ->> 'source' = 'heuristic'`,
      ),
    );
  console.log(`${pending.length} attempt(s) with a heuristic rubric; grader: ${llmProvider()}/${modelId("grader")}`);

  let updated = 0;
  for (const attempt of pending) {
    const input = await loadScoringInput(attempt);
    const rubric = input && (await llmRubric(input.variant, input.answer));
    if (!input || !rubric) {
      console.log(`  ${attempt.id}: skipped (model rubric unavailable)`);
      continue;
    }
    const score = scoreAttempt(input, rubric);
    await db.update(attempts).set({ score, total: score.total }).where(eq(attempts.id, attempt.id));
    console.log(`  ${attempt.id}: ${attempt.total} → ${score.total} (${score.level})`);
    updated++;
  }
  console.log(`Done: ${updated} updated, ${pending.length - updated} left as they were.`);
}

void main();
