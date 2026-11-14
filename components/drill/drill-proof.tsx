import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { cn } from "cn";
import { ProofShell, SectionHeading } from "@/components/proof/proof-shell";
import { ShareBar } from "@/components/proof/share-bar";
import { Button } from "@/components/ui/button";
import type { Attempt } from "@/lib/db/schema";
import type { DrillScore } from "@/lib/drill/types";
import { formatDate } from "@/lib/proof/share";

/**
 * Public proof of a daily drill. It shows how many errors were spotted, not
 * which sentence was wrong: the same set is live for everyone that day.
 */
export function DrillProof({
  attempt,
  score,
  isOwner,
  proofUrl,
}: {
  attempt: Attempt;
  score: DrillScore;
  isOwner: boolean;
  proofUrl: string;
}) {
  const issued = attempt.submittedAt ?? attempt.startedAt;
  return (
    <ProofShell demo={attempt.isDemo}>
      <section className="flex flex-col gap-8">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Daily drill · {formatDate(new Date(`${score.date}T12:00:00Z`))}
        </p>
        <h1 className="font-display text-5xl leading-[1.05] text-balance sm:text-7xl">
          Spot the AI error · {score.correct}/{score.items.length}
        </h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
          <span>{score.total}/100</span>
          {score.countsForStreak && score.streak > 0 && (
            <span className="text-foreground">
              <span aria-hidden>🔥</span> {score.streak}-day streak
            </span>
          )}
          <span>
            Finished in {score.elapsedSec}s{score.overtimeSec > 0 && ` (${score.overtimeSec}s over time)`}
          </span>
          {!score.countsForStreak && (
            <span className="rounded-full border border-dashed border-foreground/30 px-2.5 py-0.5 text-xs">
              Practice run: a retake or late submit, not the day&apos;s counted attempt
            </span>
          )}
        </p>
        <ol className="grid grid-cols-5 gap-2 sm:gap-3" aria-label="Result per item">
          {score.items.map((item, n) => (
            <li
              key={item.itemId}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-2 py-4 text-center",
                item.sentenceCorrect ? "border-violet/60 bg-violet/10" : "border-dashed",
              )}
            >
              {item.sentenceCorrect ? (
                <Check aria-label="Spotted" className="size-5 text-violet" />
              ) : (
                <X aria-label="Missed" className="size-5 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">#{n + 1}</span>
              <span className="hidden text-xs capitalize sm:block">{item.domain}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          Five AI answers to analyst questions, each with one planted error or none. Issued {formatDate(issued)} ·
          ID <span className="font-mono text-[0.82rem]">{attempt.id}</span>
        </p>
      </section>

      {isOwner ? (
        <div className="flex flex-col gap-3">
          <ShareBar
            proofUrl={proofUrl}
            imageUrl={`/p/${attempt.id}/opengraph-image`}
            fileName={`human-proof-drill-${attempt.id}.png`}
          />
          <Link
            href={`/drill/${attempt.id}`}
            className="flex items-center gap-1.5 self-start text-sm text-violet underline-offset-4 hover:underline"
          >
            See your picks against the answers <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      ) : (
        <Link
          href="/drill"
          className="group flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6 transition-colors hover:border-violet/60"
        >
          <span className="flex flex-col gap-1">
            <span className="font-display text-2xl">Can you beat {score.correct}/5?</span>
            <span className="text-sm text-muted-foreground">Same five items for everyone today. No sign-up.</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-violet">
            Try today&apos;s drill
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      <section className="flex flex-col gap-6">
        <SectionHeading eyebrow="Go further" title="The 15-minute simulation" />
        <p className="text-sm text-muted-foreground">
          A real analyst brief, a data table and an AI copilot that slips mistakes into its answers. It ends in a
          full proof you can put on LinkedIn.
        </p>
        <form action="/sim/new" method="post">
          <Button type="submit" size="lg" variant="outline">
            Start the simulation
          </Button>
        </form>
      </section>
    </ProofShell>
  );
}
