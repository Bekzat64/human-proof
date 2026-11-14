import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { DrillReview } from "@/components/drill/drill-review";
import { DrillRunner } from "@/components/drill/drill-runner";
import { ProofShell, SectionHeading } from "@/components/proof/proof-shell";
import { Button } from "@/components/ui/button";
import { getAnonId } from "@/lib/anon";
import { getAttempt } from "@/lib/attempts";
import { drillRemainingMs } from "@/lib/drill/attempts";
import { dailyDrill, dateFromScenarioId, toPublicItem } from "@/lib/drill/daily";
import type { DrillScore } from "@/lib/drill/types";

export const metadata: Metadata = { title: "Daily drill", robots: { index: false } };

/**
 * One drill attempt, for its owner: the running drill, or the result with the
 * answer key once it is submitted. Anyone else is sent to the public proof
 * (which never shows the answers), or gets a 404 while it is still running.
 */
export default async function DrillAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const [attempt, anonId] = await Promise.all([getAttempt(attemptId), getAnonId()]);
  if (!attempt || attempt.kind !== "drill") notFound();
  const isOwner = anonId !== null && attempt.anonId === anonId;

  if (!isOwner) {
    if (attempt.status === "graded") redirect(`/p/${attempt.id}`);
    notFound();
  }

  const items = dailyDrill(dateFromScenarioId(attempt.scenarioId));

  if (attempt.status === "active") {
    return (
      <ProofShell>
        <DrillRunner attemptId={attempt.id} items={items.map(toPublicItem)} remainingAtLoadMs={drillRemainingMs(attempt)} />
      </ProofShell>
    );
  }

  const score = attempt.score as DrillScore;
  return (
    <ProofShell>
      <section className="flex flex-col gap-6">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Daily drill · result</p>
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">
          {score.correct} of {score.items.length} errors spotted
        </h1>
        <p className="text-muted-foreground">
          {score.total}/100 · {score.elapsedSec}s
          {score.overtimeSec > 0 && ` (${score.overtimeSec}s over the 3 minutes)`}
          {score.countsForStreak ? (
            <>
              {" "}
              · <span aria-hidden>🔥</span> {score.streak}-day streak
            </>
          ) : (
            score.overtimeSec > 15
              ? " · submitted after the 3 minutes, so it counts as practice"
              : " · practice run, does not count toward the streak"
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={`/p/${attempt.id}`}>
              Your shareable drill proof <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/me">My progress</Link>
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Review" title="Your picks against the truth" />
        <p className="-mt-4 text-sm text-muted-foreground">
          Only you see this review. Your public proof shows the score, not the answers, so today&apos;s drill stays
          fair for everyone else.
        </p>
        <DrillReview items={items} results={score.items} />
      </section>
    </ProofShell>
  );
}
