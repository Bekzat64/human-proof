/**
 * pnpm seed:demo
 *
 * Creates (or re-creates) the two demo proofs linked from the landing page:
 *
 *   /p/demo-advanced    caught every seeded AI error, flagged exactly those
 *   /p/demo-developing  followed the AI's mistakes into the final answer
 *
 * Both are `is_demo = true`: the pages carry a DEMO watermark, and /stats and
 * percentiles leave them out. Nothing here is hand-written score JSON. Each
 * session is played through the real pieces (variant generator, opener,
 * pickClaim, fixed claim sentences, offline copilot, event log) and then
 * graded by the real gradeAttempt(), exactly like a candidate's attempt.
 *
 * Idempotent: the two attempts are deleted (with their events and feedback)
 * and written again with the same ids, seeds and timestamps.
 */
import { inArray } from "drizzle-orm";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the environment
}

type Script = {
  id: string;
  seed: number;
  /** Seconds after the start for each thing the candidate does. */
  steps: (
    | { at: number; ask: string }
    | { at: number; flag: "opener" | "last"; note: string }
    | { at: number; data: "view" | "sort" | "filter" | "download" }
    | { at: number; awaySec: number }
  )[];
  submitAt: number;
  answer: (truth: Truth, traps: Traps) => { q1: number; q2: string; q3: string; q4: string };
};

type Truth = import("../lib/scenarios/types").GroundTruth;
type Traps = import("../lib/scenarios/types").Traps;

const STARTED_AT = new Date("2026-11-14T15:00:00Z");
const DEMO_ANON = "demo-seed";

const SCRIPTS: Script[] = [
  {
    id: "demo-advanced",
    seed: 424242,
    steps: [
      { at: 4, data: "view" },
      { at: 35, data: "sort" },
      { at: 70, flag: "opener", note: "Divided by end-of-month subscribers; churn uses start-of-month" },
      { at: 95, ask: "Can you redo that with subscribers at the start of the month as the denominator?" },
      { at: 150, ask: "Is this normal compared to the industry?" },
      { at: 190, flag: "last", note: "No source for this report; our own Apr–Aug baseline is far lower" },
      { at: 240, data: "filter" },
      { at: 300, ask: "Which channel drove the increase?" },
      { at: 345, flag: "last", note: "Most cancellations is just the biggest channel; check rate change" },
      { at: 380, data: "download" },
    ],
    submitAt: 610,
    answer: (truth) => ({
      q1: Math.round(truth.sepChurnRate * 100) / 100,
      q2: truth.drivingChannel,
      q3: `September churn rose to ${truth.sepChurnRate.toFixed(2)}%, up ${truth.churnIncreasePp.toFixed(2)}pp on August, and the increase is concentrated in ${truth.drivingChannel}, whose churn rate jumped far more than any other channel. Pause the ${truth.drivingChannel} promo spend, audit the September promo cohort there for low-intent sign-ups, and fix onboarding for those subscribers before the next campaign. Track ${truth.drivingChannel} churn weekly until it is back near its baseline.`,
      q4: "Recomputed churn from start-of-month subscribers; the copilot divided by end-of-month. Did not trust the industry report it cited: no source. Compared rate changes by channel instead of raw cancellations.",
    }),
  },
  {
    id: "demo-developing",
    seed: 77,
    steps: [
      { at: 6, data: "view" },
      { at: 60, ask: "Thanks. What does the trend look like over earlier months?" },
      { at: 140, awaySec: 75 },
      { at: 260, ask: "Is this normal for the industry?" },
      { at: 330, ask: "Which channel caused it?" },
    ],
    submitAt: 540,
    answer: (_truth, traps) => ({
      q1: traps.T1.trapValue,
      q2: traps.T3.trapValue,
      q3: `Churn is within the normal range for the industry (about ${traps.T2.trapValue}% for meal kits), so this is not a crisis. ${traps.T3.trapValue} had the most cancellations, so we should look at ${traps.T3.trapValue} acquisition quality next quarter.`,
      q4: "Copilot numbers.",
    }),
  },
];

async function main() {
  const { getDb } = await import("../lib/db");
  const { attempts, events, feedback } = await import("../lib/db/schema");
  const { buildVariant } = await import("../lib/variant");
  const { copilotOpener, pickClaim } = await import("../lib/copilot");
  const { writeCopilotReply } = await import("../lib/copilot-reply");
  const { churnMealkit } = await import("../lib/scenarios/churn-mealkit");
  const { answerSchema } = await import("../lib/answers");
  const { gradeAttempt } = await import("../lib/grading/compose");

  const db = getDb();
  const ids = SCRIPTS.map((s) => s.id);
  await db.delete(feedback).where(inArray(feedback.attemptId, ids));
  await db.delete(attempts).where(inArray(attempts.id, ids)); // events cascade

  for (const script of SCRIPTS) {
    const variant = buildVariant(script.seed);
    const at = (sec: number) => new Date(STARTED_AT.getTime() + sec * 1000);
    const answer = answerSchema.parse(script.answer(variant.groundTruth, variant.traps));

    type Row = { attemptId: string; ts: Date; type: (typeof events.$inferInsert)["type"]; payload: unknown };
    const rows: Row[] = [];
    const push = (sec: number, type: Row["type"], payload: unknown) =>
      rows.push({ attemptId: script.id, ts: at(sec), type, payload });

    // The templated opener carries T1, exactly as createSimAttempt writes it.
    const openerId = `msg_${script.id}_opener`;
    push(0, "ai_response", {
      messageId: openerId,
      text: copilotOpener(variant),
      trapId: "T1",
      trapAttempted: "T1",
      exposed: true,
      source: "template",
    });

    const shown = new Set<"T1" | "T2" | "T3">(["T1"]);
    let lastReplyId = openerId;
    let asked = 0;
    for (const step of script.steps) {
      if ("ask" in step) {
        asked++;
        push(step.at, "prompt", { messageId: `msg_${script.id}_u${asked}`, text: step.ask });
        // The same decision and the same reply writer as /api/copilot (offline mode).
        const claim = pickClaim({ message: step.ask, userMessageNumber: asked, history: { shown } });
        if (claim) shown.add(claim);
        const { reply } = await writeCopilotReply({ variant, claim, message: step.ask, history: [], emit: () => {} });
        lastReplyId = `msg_${script.id}_a${asked}`;
        push(step.at + 2, "ai_response", {
          messageId: lastReplyId,
          text: reply,
          trapId: claim,
          trapAttempted: claim,
          exposed: claim !== null,
          source: "offline",
        });
      } else if ("flag" in step) {
        push(step.at, "flag", { messageId: step.flag === "opener" ? openerId : lastReplyId, note: step.note });
      } else if ("data" in step) {
        push(
          step.at,
          "data_view",
          step.data === "sort"
            ? { action: "sort", column: "cancellations", direction: "desc" }
            : step.data === "filter"
              ? { action: "filter", channel: variant.groundTruth.drivingChannel }
              : { action: step.data },
        );
      } else {
        push(step.at, "blur", {});
        push(step.at + step.awaySec, "focus", { awayMs: step.awaySec * 1000 });
      }
    }
    push(script.submitAt, "submit", { elapsedSec: script.submitAt, overtimeSec: 0 });

    await db.insert(attempts).values({
      id: script.id,
      anonId: DEMO_ANON,
      kind: "sim",
      scenarioId: churnMealkit.id,
      seed: script.seed,
      status: "submitted",
      startedAt: STARTED_AT,
      submittedAt: at(script.submitAt),
      answer,
      isDemo: true,
    });
    await db.insert(events).values(rows);

    const score = await gradeAttempt(script.id);
    if (!score) throw new Error(`grading ${script.id} failed`);
    const traps = score.traps.map((t) => `${t.id}:${t.outcome}`).join(" ");
    console.log(
      `${script.id}: ${score.total}/100 ${score.level} · ${traps} · reasoning ${score.dimensions.reasoning.source}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
