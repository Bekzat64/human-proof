import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { Checkin } from "@/components/me/checkin";
import { ProofShell, SectionHeading } from "@/components/proof/proof-shell";
import { StartButton } from "@/components/start-button";
import { Button } from "@/components/ui/button";
import { getAnonId } from "@/lib/anon";
import type { CheckinQuestion } from "@/lib/checkin";
import { getDb } from "@/lib/db";
import { attempts, feedback } from "@/lib/db/schema";
import { computeStreak } from "@/lib/drill/score";
import { dateFromScenarioId, drillDateKey, previousDateKey } from "@/lib/drill/daily";
import { REASON_LABELS, type DrillScore } from "@/lib/drill/types";
import { DIMENSIONS, type Score } from "@/lib/grading/types";
import { drillAccuracy, nextStep, simRatios, type SimPoint } from "@/lib/me";
import { DIMENSION_LABELS } from "@/lib/proof/employer";
import { formatDate } from "@/lib/proof/share";

export const metadata: Metadata = { title: "My proofs", robots: { index: false } };

/** This browser's record: history, streak, trend, next step. No account: it is keyed by the anonymous cookie. */
async function MeContent() {
  const anonId = await getAnonId();
  const rows = anonId
    ? await getDb().select().from(attempts).where(eq(attempts.anonId, anonId)).orderBy(desc(attempts.startedAt))
    : [];

  if (rows.length === 0) {
    return (
      <ProofShell>
        <section className="flex flex-col items-start gap-6">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">My proofs</p>
          <h1 className="font-display text-5xl leading-tight sm:text-6xl">Nothing here yet</h1>
          <p className="max-w-xl text-pretty text-muted-foreground">
            Your drills and simulations will show up here, in this browser, with your streak and how you are
            trending. No account needed.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/drill">Try the 3-minute drill</Link>
            </Button>
            <StartButton kind="sim" size="lg" variant="outline">
              Start the 15-minute simulation
            </StartButton>
          </div>
        </section>
      </ProofShell>
    );
  }

  const today = drillDateKey(new Date());
  const drills = rows.filter((a) => a.kind === "drill" && a.status === "graded" && a.score);
  // Only counted drills (on time, first of their day) make a streak.
  const drillDates = drills
    .filter((a) => (a.score as DrillScore).countsForStreak)
    .map((a) => dateFromScenarioId(a.scenarioId));
  const streak = computeStreak(drillDates, today, previousDateKey);
  const accuracy = drillAccuracy(drills.map((a) => a.score as DrillScore));

  const gradedSims = rows.filter((a) => a.kind === "sim" && a.status === "graded" && a.score);
  const sims: SimPoint[] = gradedSims
    .slice(0, 5)
    .reverse()
    .map((a) => ({ id: a.id, date: a.submittedAt ?? a.startedAt, ratios: simRatios(a.score as Score) }));
  const step = nextStep({ sims, drillDoneToday: drillDates.includes(today), accuracy });

  // The check-in hangs off the first proof ever earned in this browser.
  const firstProof = [...rows].reverse().find((a) => a.status === "graded");
  const answered: Partial<Record<CheckinQuestion, boolean>> = {};
  if (firstProof && anonId) {
    const given = await getDb()
      .select({ kind: feedback.kind, value: feedback.value })
      .from(feedback)
      .where(and(eq(feedback.attemptId, firstProof.id), eq(feedback.source, "candidate"), eq(feedback.anonId, anonId)))
      .orderBy(asc(feedback.id));
    for (const row of given) answered[row.kind as CheckinQuestion] = (row.value as { answer: boolean }).answer;
  }

  return (
    <ProofShell>
      <section className="flex flex-col gap-8">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">My proofs</p>
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">Your record</h1>
        <dl className="grid grid-cols-3 gap-6 border-y py-6">
          <Stat label="Drill streak">
            {streak > 0 && <span aria-hidden>🔥 </span>}
            {streak} {streak === 1 ? "day" : "days"}
          </Stat>
          <Stat label="Simulations">{gradedSims.length}</Stat>
          <Stat label="Drills">{drills.length}</Stat>
        </dl>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-violet/50 bg-violet/[0.07] p-6">
        <p className="text-xs font-medium tracking-[0.2em] text-violet uppercase">Next step</p>
        <p className="text-pretty">{step.reason}</p>
        <div className="flex flex-wrap gap-3">
          {(step.kind === "drill" || step.kind === "start") && (
            <Button asChild size="lg">
              <Link href="/drill">
                Take today&apos;s drill <ArrowRight aria-hidden />
              </Link>
            </Button>
          )}
          {(step.kind === "sim" || step.kind === "start") && (
            <StartButton kind="sim" variant={step.kind === "sim" ? "default" : "outline"}>
              Start a new simulation
            </StartButton>
          )}
        </div>
      </section>

      {firstProof && (
        <section className="flex flex-col gap-6">
          <SectionHeading eyebrow="Check-in" title="Since your first proof" />
          <div className="rounded-xl border bg-card p-6">
            <Checkin attemptId={firstProof.id} answered={answered} />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Trend" title="Last 5 simulations" />
        {sims.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No graded simulation yet. Your four dimensions will be charted here after the first one.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {DIMENSIONS.map((d) => (
              <div key={d} className="grid grid-cols-[9rem_1fr] items-end gap-4 sm:grid-cols-[13rem_1fr]">
                <span className="pb-1 text-sm">{DIMENSION_LABELS[d]}</span>
                <div className="flex h-16 items-end gap-2" role="img" aria-label={`${DIMENSION_LABELS[d]}: ${sims.map((s) => (s.ratios[d] === null ? "not assessed" : `${Math.round(s.ratios[d]! * 100)}%`)).join(", ")}, oldest first`}>
                  {sims.map((s) => (
                    <div key={s.id} className="flex h-full w-8 flex-col justify-end rounded-sm bg-foreground/[0.06]" title={formatDate(s.date)}>
                      {s.ratios[d] !== null && (
                        <div className="rounded-sm bg-violet" style={{ height: `${Math.max(4, Math.round(s.ratios[d]! * 100))}%` }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Oldest on the left. Each bar is the share of that dimension&apos;s points.</p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Drills" title="Errors spotted, by type" />
        {drills.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No drills yet. <Link href="/drill" className="text-violet underline-offset-4 hover:underline">Take today&apos;s</Link> to start a streak.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {(["wrong_math", "fabricated_source", "wrong_conclusion", "none"] as const).map((r) => {
              const { seen, spotted } = accuracy[r];
              return (
                <div key={r} className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span>{r === "none" ? "Clean answers (nothing wrong)" : REASON_LABELS[r]}</span>
                    <span className="tabular-nums text-muted-foreground">{seen === 0 ? "not seen yet" : `${spotted} of ${seen}`}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <div className="h-full rounded-full bg-violet" style={{ width: `${seen === 0 ? 0 : Math.round((spotted / seen) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading eyebrow="History" title="Everything, newest first" />
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {rows.map((a) => {
            const isDrill = a.kind === "drill";
            const href = a.status === "active" ? (isDrill ? `/drill/${a.id}` : `/sim/${a.id}`) : `/p/${a.id}`;
            const result =
              a.status === "active"
                ? "In progress"
                : a.status === "submitted"
                  ? "Grading…"
                  : isDrill
                    ? `${(a.score as DrillScore).correct}/5 spotted · ${a.total}/100`
                    : `${(a.score as Score).level} · ${a.total}/100`;
            return (
              <li key={a.id}>
                <Link href={href} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-foreground/[0.03]">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{isDrill ? "Daily drill" : "Simulation · Churn spike"}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(a.submittedAt ?? a.startedAt)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm tabular-nums">
                    {result} <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </ProofShell>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-display text-3xl">{children}</dd>
    </div>
  );
}

/** The shell renders at once; the record streams in behind a skeleton. */
export default function MePage() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading your record…" />}>
      <MeContent />
    </Suspense>
  );
}
