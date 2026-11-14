import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { DrillProof } from "@/components/drill/drill-proof";
import { DimensionBars } from "@/components/proof/dimension-bars";
import { GradingPoller } from "@/components/proof/grading-poller";
import { ProofHero } from "@/components/proof/hero";
import { IntegrityNotes } from "@/components/proof/integrity-notes";
import { ProofShell, SectionHeading } from "@/components/proof/proof-shell";
import { ReplayTimeline } from "@/components/proof/replay-timeline";
import { ShareBar } from "@/components/proof/share-bar";
import { TrapCards } from "@/components/proof/trap-cards";
import { Button } from "@/components/ui/button";
import type { DrillScore } from "@/lib/drill/types";
import type { Score } from "@/lib/grading/types";
import { hasActivePass } from "@/lib/pass";
import { standingFor } from "@/lib/percentile";
import { PRACTICE_LABELS } from "@/lib/proof/employer";
import { getProofAttempt, loadEvents, loadProof } from "@/lib/proof/load";
import { CREDENTIAL_NAME, linkedInAddUrl, resumeLine } from "@/lib/proof/share";
import { buildTimeline } from "@/lib/proof/timeline";
import { getBaseUrl } from "@/lib/site-url";

type Props = { params: Promise<{ attemptId: string }> };

/** Replay events anyone can see; the rest needs a Job-Search Pass. */
const FREE_REPLAY_EVENTS = 5;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { attemptId } = await params;
  const attempt = await getProofAttempt(attemptId);
  // Nothing about an ungraded or unknown attempt leaks into the page title.
  if (!attempt || attempt.status !== "graded" || !attempt.score) {
    return { title: "Proof", robots: { index: false } };
  }
  if (attempt.kind === "drill") {
    const drill = attempt.score as DrillScore;
    const title = `Spot the AI error · ${drill.correct}/${drill.items.length}${drill.countsForStreak && drill.streak > 1 ? ` · ${drill.streak}-day streak` : ""}`;
    const description = `Spotted ${drill.correct} of ${drill.items.length} planted errors in AI answers in today's 3-minute drill. Can you beat it?`;
    return {
      metadataBase: new URL(await getBaseUrl()),
      title,
      description,
      openGraph: { title: `${title} · HUMAN PROOF`, description, type: "website", url: `/p/${attempt.id}` },
      twitter: { card: "summary_large_image", title: `${title} · HUMAN PROOF`, description },
    };
  }
  const score = attempt.score as Score;
  const { exposed, caught } = score.dimensions.aiJudgment;
  const title = `${score.level} · ${score.total}/100 — ${CREDENTIAL_NAME}${attempt.isDemo ? " (DEMO)" : ""}`;
  const description =
    exposed === 0
      ? `Scored ${score.total}/100 in a timed analyst simulation with an AI copilot. Verified on HUMAN PROOF.`
      : `Caught ${caught} of ${exposed} mistakes an AI copilot made during a timed analyst simulation, scoring ${score.total}/100. Verified on HUMAN PROOF.`;
  return {
    metadataBase: new URL(await getBaseUrl()),
    title,
    description,
    openGraph: { title: `${title} · HUMAN PROOF`, description, type: "website", url: `/p/${attempt.id}` },
    twitter: { card: "summary_large_image", title: `${title} · HUMAN PROOF`, description },
  };
}

/** Public Proof page: the credential, what was caught, how the work was done. */
export default async function ProofPage({ params }: Props) {
  const { attemptId } = await params;
  const access = await loadProof(attemptId);
  if (access.kind === "not_found") notFound();

  if (access.kind === "drill") {
    return (
      <DrillProof
        attempt={access.attempt}
        score={access.score}
        isOwner={access.isOwner}
        proofUrl={`${await getBaseUrl()}/p/${access.attempt.id}`}
      />
    );
  }

  if (access.kind === "pending") {
    const { attempt } = access;
    if (attempt.kind === "drill") redirect(`/drill/${attempt.id}`);
    return (
      <ProofShell>
        <section className="flex flex-col items-start gap-5 rounded-xl border bg-card p-8">
          {attempt.status === "active" ? (
            <>
              <h1 className="font-display text-4xl">This simulation is still in progress</h1>
              <p className="text-sm text-muted-foreground">
                Submit your answers to close the attempt. Your proof appears here afterwards.
              </p>
              <Button asChild size="lg">
                <Link href={`/sim/${attempt.id}`}>Back to the simulation</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="font-display text-4xl">Answers submitted</h1>
              <GradingPoller attemptId={attempt.id} />
            </>
          )}
        </section>
      </ProofShell>
    );
  }

  const { attempt, score, isOwner } = access;
  const [standing, events, baseUrl, fullReplay] = await Promise.all([
    standingFor(attempt.scenarioId, score.total),
    loadEvents(attempt.id),
    getBaseUrl(),
    hasActivePass(attempt.anonId),
  ]);

  const proofUrl = `${baseUrl}/p/${attempt.id}`;
  const issued = attempt.submittedAt ?? attempt.startedAt;
  const { aiJudgment, reasoning } = score.dimensions;

  // Cut on the server: locked events never reach the browser.
  const timeline = buildTimeline(events, attempt.startedAt);
  const visible = fullReplay ? timeline : timeline.slice(0, FREE_REPLAY_EVENTS);

  return (
    <ProofShell demo={attempt.isDemo}>
      <ProofHero score={score} standing={standing} issued={issued} attemptId={attempt.id} proofUrl={proofUrl} />

      {isOwner ? (
        <div className="flex flex-col gap-3">
          <ShareBar
            proofUrl={proofUrl}
            linkedInUrl={linkedInAddUrl({ level: score.level, certUrl: proofUrl, certId: attempt.id, issued })}
            resumeLine={resumeLine({
              level: score.level,
              total: score.total,
              percentile: standing.earlyPilot ? null : standing.percentile,
              url: proofUrl,
            })}
            imageUrl={`/p/${attempt.id}/opengraph-image`}
            fileName={`human-proof-${attempt.id}.png`}
          />
          <Link
            href={`/p/${attempt.id}/employer`}
            className="flex items-center gap-1.5 self-start text-sm text-violet underline-offset-4 hover:underline"
          >
            Preview the view employers get <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      ) : (
        <Link
          href="/drill"
          className="group flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6 transition-colors hover:border-violet/60"
        >
          <span className="flex flex-col gap-1">
            <span className="font-display text-2xl">Can you catch the AI&apos;s mistake?</span>
            <span className="text-sm text-muted-foreground">No sign-up. Three minutes.</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-violet">
            Take the 3-minute drill
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      <section className="flex flex-col gap-8">
        <SectionHeading
          eyebrow="AI judgment"
          title={
            aiJudgment.exposed === 0
              ? "No AI errors were shown"
              : `Caught ${aiJudgment.caught} of ${aiJudgment.exposed} AI errors`
          }
        />
        <TrapCards traps={score.traps} />
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow={`Scoring ${score.version}`} title="How the score breaks down" />
        <DimensionBars score={score} />
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Feedback" title="Strength and gap" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-6">
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Strength</p>
            <p className="text-sm leading-relaxed text-pretty">{reasoning.strength}</p>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-6">
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Gap</p>
            <p className="text-sm leading-relaxed text-pretty">{reasoning.gap}</p>
          </div>
        </div>
        <Button asChild size="lg" variant={isOwner ? "default" : "outline"} className="self-start">
          <Link href="/drill">
            Next: practice {PRACTICE_LABELS[reasoning.nextDrill] ?? "catching AI mistakes"} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Process replay" title="How the work was done" />
        <ReplayTimeline items={visible} lockedCount={timeline.length - visible.length} />
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Integrity notes" title="What was observed" />
        <IntegrityNotes notes={score.integrityNotes} />
      </section>
    </ProofShell>
  );
}
