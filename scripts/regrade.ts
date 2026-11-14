/**
 * pnpm regrade --heuristic-only
 *
 * Attempts graded while no LLM key was configured carry a rule-based
 * ("heuristic") reasoning score. Once a key exists, this re-runs the model
 * rubric for exactly those attempts and stores the updated score. The
 * deterministic 75 points are recomputed from the same inputs, so they do
 * not move.
 */
import { and, eq, sql } from "drizzle-orm";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the environment
}

async function main() {
  if (!process.argv.includes("--heuristic-only")) {
    console.error("Usage: pnpm regrade --heuristic-only");
    process.exit(1);
  }

  const { getDb } = await import("../lib/db");
  const { attempts } = await import("../lib/db/schema");
  const { loadScoringInput } = await import("../lib/grading/compose");
  const { llmRubric } = await import("../lib/grading/llm");
  const { scoreAttempt } = await import("../lib/grading/score");
  const { isLlmAvailable, llmProvider, modelId } = await import("../lib/llm");

  if (!isLlmAvailable()) {
    console.error(`No API key for LLM_PROVIDER=${llmProvider()}. Nothing to do.`);
    process.exit(1);
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
