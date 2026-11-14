import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { ProofShell, SectionHeading } from "@/components/proof/proof-shell";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { attempts, feedback } from "@/lib/db/schema";
import { REASON_LABELS, type DrillScore } from "@/lib/drill/types";
import { DIMENSIONS, type Score } from "@/lib/grading/types";
import { DIMENSION_LABELS } from "@/lib/proof/employer";
import { computeStats, isQaAnon, qaAnonIdsFromEnv } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Stats",
  description: "How people do against an AI copilot that makes mistakes. Real attempts only; every number shows its n.",
};

// Read at request time: the numbers move as people take the simulation.
export const dynamic = "force-dynamic";

const TRAP_NAMES: Record<string, string> = {
  T1: "Wrong denominator in the churn rate",
  T2: "Invented industry benchmark",
  T3: "Blamed the biggest channel, not the one that changed",
};

const pct = (part: number, whole: number) => (whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`);

/** Public numbers from real attempts: no demo rows, none of our own testing. */
export default async function StatsPage() {
  const db = getDb();
  const qa = qaAnonIdsFromEnv(process.env.QA_ANON_IDS);

  const [graded, verdictRows] = await Promise.all([
    db
      .select({ kind: attempts.kind, anonId: attempts.anonId, score: attempts.score })
      .from(attempts)
      .where(and(eq(attempts.status, "graded"), eq(attempts.isDemo, false))),
    db
      .select({ anonId: feedback.anonId, value: feedback.value, ownerAnon: attempts.anonId, isDemo: attempts.isDemo })
      .from(feedback)
      .innerJoin(attempts, eq(feedback.attemptId, attempts.id))
      .where(and(eq(feedback.source, "employer"), eq(feedback.kind, "interview_verdict"))),
  ]);

  const real = graded.filter((a) => a.score && !isQaAnon(a.anonId, qa));
  const stats = computeStats({
    sims: real.filter((a) => a.kind === "sim").map((a) => a.score as Score),
    drills: real.filter((a) => a.kind === "drill").map((a) => a.score as DrillScore),
    verdicts: verdictRows
      .filter((r) => !r.isDemo && !isQaAnon(r.anonId, qa) && !isQaAnon(r.ownerAnon, qa))
      .map((r) => (r.value as { verdict: "would_interview" | "not_yet" }).verdict),
  });
  const { sims, drills, employer } = stats;

  return (
    <ProofShell>
      <section className="flex flex-col gap-4">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Public stats</p>
        <h1 className="font-display text-5xl leading-tight text-balance sm:text-6xl">How people do against a flawed AI</h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          Every number comes from real attempts. Demo records and our own test runs are excluded, and each figure
          shows how many attempts it rests on (n).
        </p>
      </section>

      {sims.n === 0 && drills.n === 0 ? (
        <section className="flex flex-col items-start gap-4 rounded-xl border border-dashed p-8">
          <h2 className="font-display text-3xl">No real attempts yet · n=0</h2>
          <p className="text-sm text-muted-foreground">
            Nothing to report until people take the simulation or the drill. Be the first.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/drill">Try the 3-minute drill</Link>
            </Button>
            <form action="/sim/new" method="post">
              <Button type="submit" size="lg" variant="outline">
                Start the 15-minute simulation
              </Button>
            </form>
          </div>
        </section>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-6 border-y py-6 sm:grid-cols-4">
            <Stat label="Simulations" value={String(sims.n)} />
            <Stat label="Drills" value={String(drills.n)} />
            <Stat
              label="Missed ≥1 AI error"
              value={pct(sims.missedAtLeastOne, sims.withExposed)}
              n={sims.withExposed}
            />
            <Stat
              label="Average simulation score"
              value={sims.averageTotal === null ? "—" : `${Math.round(sims.averageTotal)}/100`}
              n={sims.n}
            />
          </dl>

          <section className="flex flex-col gap-6">
            <SectionHeading eyebrow="Most missed" title={sims.mostMissed ? TRAP_NAMES[sims.mostMissed.id] ?? sims.mostMissed.id : "Nothing missed yet"} />
            <p className="text-sm text-muted-foreground">
              {sims.mostMissed
                ? `Missed in ${sims.mostMissed.missed} of ${sims.mostMissed.shown} simulations where the copilot made it (n=${sims.mostMissed.shown}).`
                : `No AI error has been missed yet (n=${sims.withExposed}).`}
            </p>
          </section>

          <section className="flex flex-col gap-6">
            <SectionHeading eyebrow="Simulations" title="Average score by dimension" />
            {DIMENSIONS.map((d) => (
              <Bar key={d} label={DIMENSION_LABELS[d]} ratio={sims.dimensions[d].avg} n={sims.dimensions[d].n} />
            ))}
          </section>

          <section className="flex flex-col gap-6">
            <SectionHeading eyebrow="Daily drill" title="Errors spotted, by type" />
            {(["wrong_math", "fabricated_source", "wrong_conclusion", "none"] as const).map((r) => {
              const { seen, spotted } = drills.byReason[r];
              return (
                <Bar
                  key={r}
                  label={r === "none" ? "Clean answers (called correctly)" : REASON_LABELS[r]}
                  ratio={seen ? spotted / seen : null}
                  n={seen}
                />
              );
            })}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeading
              eyebrow="Employers"
              title={`“Would interview”: ${pct(employer.wouldInterview, employer.n)}`}
              aside={
                <span className="rounded-full border border-dashed border-foreground/30 px-2.5 py-0.5 text-xs uppercase">
                  unverified
                </span>
              }
            />
            <p className="text-sm text-muted-foreground">
              n={employer.n}. Anyone who opens an employer view can answer, and we do not verify who they are, so read
              this as a signal, not a hiring rate.
            </p>
          </section>
        </>
      )}
    </ProofShell>
  );
}

function Stat({ label, value, n }: { label: string; value: string; n?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-display text-3xl">{value}</dd>
      {n !== undefined && <dd className="text-xs text-muted-foreground">n={n}</dd>}
    </div>
  );
}

function Bar({ label, ratio, n }: { label: string; ratio: number | null; n: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-4 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {ratio === null ? "—" : `${Math.round(ratio * 100)}%`} · n={n}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-violet" style={{ width: `${ratio === null ? 0 : Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  );
}
