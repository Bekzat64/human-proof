import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GradingPoller } from "@/components/proof/grading-poller";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnonId } from "@/lib/anon";
import { getAttempt } from "@/lib/attempts";
import type { Score, TrapOutcome } from "@/lib/grading/types";
import { standingFor } from "@/lib/percentile";

export const metadata: Metadata = { title: "Proof" };

const OUTCOME: Record<TrapOutcome, string> = {
  caught_by_flag_and_answer: "Caught — flagged it and did not rely on it",
  caught_by_flag: "Flagged it, but the final answer still relied on it",
  caught_by_answer: "Avoided in the final answer, not flagged",
  missed: "Missed",
  not_shown: "Not shown in this attempt",
};

const CRITERIA: Record<string, string> = {
  evidenceBased: "Evidence-based",
  addressesCause: "Addresses the cause",
  actionable: "Actionable recommendation",
  clearConcise: "Clear and concise",
  statesVerification: "States verification",
};

/**
 * Public Proof page — raw breakdown. The designed page (replay timeline,
 * sharing, employer view) is Stage 4; this shows every number as stored.
 */
export default async function ProofPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const [attempt, anonId] = await Promise.all([getAttempt(attemptId), getAnonId()]);
  if (!attempt || attempt.kind !== "sim") notFound();

  // An attempt that is still running has nothing public to show.
  if (attempt.status === "active") {
    if (attempt.anonId !== anonId) notFound();
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>This simulation is still in progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4 text-sm text-muted-foreground">
            <p>Submit your answers to close the attempt. Your Proof will appear here afterwards.</p>
            <Button asChild>
              <Link href={`/sim/${attempt.id}`}>Back to the simulation</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (attempt.status === "submitted" || !attempt.score) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Answers submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <GradingPoller attemptId={attempt.id} />
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const score = attempt.score as Score;
  const standing = await standingFor(attempt.scenarioId, score.total);
  const { correctness, aiJudgment, reasoning, process } = score.dimensions;
  const estimated = reasoning.source === "heuristic";

  return (
    <Shell>
      {attempt.isDemo && <Badge variant="destructive">DEMO — not a real candidate</Badge>}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-2xl">
              {score.total} / 100 · {score.level}
            </CardTitle>
            <Badge variant="outline">Scoring {score.version}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>
            {standing.earlyPilot
              ? `Early pilot — percentile unlocks at 10 attempts (n=${standing.n}).`
              : `Scored higher than ${standing.percentile}% of attempts (n=${standing.n}).`}
          </p>
          <p>
            Attempt <span className="font-mono">{attempt.id}</span>
            {attempt.submittedAt && ` · submitted ${attempt.submittedAt.toISOString().slice(0, 10)}`}
          </p>
        </CardContent>
      </Card>

      <Section title="Breakdown">
        <Row label="Correctness" value={`${correctness.score} / ${correctness.max}`}>
          September churn: answered {correctness.q1.answer}%, {correctness.q1.correct ? "correct" : "incorrect"} (
          {correctness.q1.points}/{correctness.q1.max}). Channel: answered {correctness.q2.answer},{" "}
          {correctness.q2.correct ? "correct" : "incorrect"} ({correctness.q2.points}/{correctness.q2.max}).
        </Row>
        <Row label="AI judgment" value={`${aiJudgment.score} / ${aiJudgment.max}`}>
          Caught {aiJudgment.caught} of {aiJudgment.exposed} AI mistakes shown in this attempt.
        </Row>
        <Row
          label={`Reasoning & communication${estimated ? " (estimated)" : ""}`}
          value={`${reasoning.score} / ${reasoning.max}`}
        >
          {Object.entries(reasoning.criteria)
            .map(([key, value]) => `${CRITERIA[key] ?? key} ${value}/5`)
            .join(" · ")}
          {estimated && ". Estimated by rules, not yet reviewed by a model."}
          {reasoning.capped && " Capped: the answers contain text addressed to the grader."}
        </Row>
        <Row label="Process" value={`${process.score} / ${process.max}`}>
          {[
            ["Inspected the data", process.checks.inspectedData],
            ["Used the copilot", process.checks.usedCopilot],
            ["Questioned the AI", process.checks.questionedAi],
            ["Submitted within 15 minutes", process.checks.withinTime],
          ]
            .map(([label, ok]) => `${label}: ${ok ? "yes" : "no"}`)
            .join(" · ")}
        </Row>
      </Section>

      <Section title="AI mistakes">
        {score.traps.map((trap) => (
          <div key={trap.id} className="flex flex-col gap-1 border-t py-3 text-sm first:border-t-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {trap.id} · {OUTCOME[trap.outcome]}
              </span>
              {trap.exposed && (
                <span className="tabular-nums text-muted-foreground">
                  {trap.points} / {trap.max}
                </span>
              )}
            </div>
            <p>
              <span className="text-muted-foreground">The AI claimed:</span> {trap.claimed}
            </p>
            <p>
              <span className="text-muted-foreground">What was true:</span> {trap.truth}
            </p>
          </div>
        ))}
      </Section>

      <Section title="Feedback">
        <p className="text-sm">{reasoning.strength}</p>
        <p className="text-sm">{reasoning.gap}</p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {reasoning.employerSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Suggested next focus: {reasoning.nextDrill}</p>
      </Section>

      <Section title="Integrity notes">
        {score.integrityNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing unusual was recorded.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {score.integrityNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </Section>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t py-3 text-sm first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-8">
      <Link href="/" className="text-sm font-semibold tracking-[0.2em]">
        HUMAN PROOF
      </Link>
      <main className="flex flex-col gap-4">{children}</main>
    </div>
  );
}
