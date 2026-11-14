import type { Score } from "@/lib/grading/types";
import { DIMENSION_LABELS, falseFlags, otherFlags } from "@/lib/proof/employer";
import { EstimatedTag } from "./proof-shell";

const CRITERIA: Record<string, string> = {
  evidenceBased: "evidence",
  addressesCause: "cause",
  actionable: "actionable",
  clearConcise: "clarity",
  statesVerification: "verification",
};

/** The four scored dimensions, each with the facts behind its number. */
export function DimensionBars({ score }: { score: Score }) {
  const { correctness, aiJudgment, reasoning, process } = score.dimensions;
  const wrongFlags = falseFlags(score);
  const neutralFlags = otherFlags(score);
  const yes = (ok: boolean) => (ok ? "yes" : "no");

  return (
    <div className="flex flex-col gap-8">
      <Bar label={DIMENSION_LABELS.correctness} score={correctness.score} max={correctness.max}>
        September churn rate: answered {correctness.q1.answer}%, {correctness.q1.correct ? "correct" : "incorrect"}.
        Channel behind the increase: answered {correctness.q2.answer}, {correctness.q2.correct ? "correct" : "incorrect"}.
      </Bar>
      <Bar label={DIMENSION_LABELS.aiJudgment} score={aiJudgment.score} max={aiJudgment.max}>
        {aiJudgment.exposed === 0
          ? "No seeded AI mistakes were shown, so these points moved to Correctness."
          : `Caught ${aiJudgment.caught} of ${aiJudgment.exposed} AI mistakes shown.`}
        {wrongFlags > 0 &&
          ` Also flagged ${wrongFlags} correct ${wrongFlags === 1 ? "answer" : "answers"} as wrong, which lowers the credit for flags.`}
        {neutralFlags > 0 && ` Flagged ${neutralFlags} other ${neutralFlags === 1 ? "reply" : "replies"}.`}
      </Bar>
      <Bar
        label={DIMENSION_LABELS.reasoning}
        score={reasoning.score}
        max={reasoning.max}
        tag={reasoning.source === "heuristic" ? <EstimatedTag /> : undefined}
      >
        {Object.entries(reasoning.criteria)
          .map(([key, value]) => `${CRITERIA[key] ?? key} ${value}/5`)
          .join(" · ")}
        {reasoning.source === "heuristic" && ". Estimated by rules; not yet reviewed by a model."}
        {reasoning.capped && " Capped: the written answers contain text addressed to the grader."}
      </Bar>
      <Bar label={DIMENSION_LABELS.process} score={process.score} max={process.max}>
        Sorted, filtered or downloaded the data: {yes(process.checks.inspectedData)} · used the copilot:{" "}
        {yes(process.checks.usedCopilot)} · questioned the AI: {yes(process.checks.questionedAi)} · within 15
        minutes: {yes(process.checks.withinTime)}
      </Bar>
    </div>
  );
}

function Bar({
  label,
  score,
  max,
  tag,
  children,
}: {
  label: string;
  score: number;
  max: number;
  tag?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="flex flex-wrap items-center gap-2.5 font-medium">
          {label}
          {tag}
        </span>
        <span className="tabular-nums">
          {max > 0 ? (
            <>
              {score} <span className="text-muted-foreground">/ {max}</span>
            </>
          ) : (
            <span className="text-muted-foreground">not assessed</span>
          )}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={score}
        className="h-1.5 overflow-hidden rounded-full bg-foreground/10"
      >
        <div className="h-full rounded-full bg-violet" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
