import type { Score } from "@/lib/grading/types";
import type { Standing } from "@/lib/percentile";
import { CREDENTIAL_NAME, formatDate, validUntil } from "@/lib/proof/share";

/** The credential itself: level, score, standing, dates, and where to verify it. */
export function ProofHero({
  score,
  standing,
  issued,
  attemptId,
  proofUrl,
}: {
  score: Score;
  standing: Standing;
  issued: Date;
  attemptId: string;
  proofUrl: string;
}) {
  const { exposed, caught } = score.dimensions.aiJudgment;
  return (
    <section aria-labelledby="proof-level" className="flex flex-col gap-10">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Proof of {CREDENTIAL_NAME}
          </p>
          <h1 id="proof-level" className="font-display text-6xl leading-[0.95] sm:text-8xl">
            {score.level}
          </h1>
          <p className="max-w-md text-base text-pretty text-muted-foreground">
            {exposed === 0
              ? "Completed a timed analyst simulation with an AI copilot."
              : `Caught ${caught} of ${exposed} mistakes an AI copilot made during a timed analyst simulation.`}
          </p>
        </div>
        <ScoreDial total={score.total} />
      </div>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 border-y py-6 text-sm sm:grid-cols-4">
        <Fact label="Standing">
          {standing.earlyPilot ? (
            <>
              Early pilot <span className="text-muted-foreground">· n={standing.n}</span>
            </>
          ) : (
            <>
              Above {standing.percentile}% <span className="text-muted-foreground">· n={standing.n}</span>
            </>
          )}
        </Fact>
        <Fact label="Issued">{formatDate(issued)}</Fact>
        <Fact label="Valid until">{formatDate(validUntil(issued))}</Fact>
        <Fact label="Credential ID">
          <span className="font-mono text-[0.82rem]">{attemptId}</span>
        </Fact>
      </dl>

      <p className="text-sm text-muted-foreground">
        <span className="text-foreground">Verify:</span> this page is the record. Its address is{" "}
        <span className="font-mono text-[0.82rem] break-all text-violet">{proofUrl}</span>
        {standing.earlyPilot && (
          <span className="block pt-1">
            Percentile unlocks at 10 graded attempts; until then only the count is shown.
          </span>
        )}
      </p>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** Score out of 100 as a ring: the page's one piece of violet. */
function ScoreDial({ total }: { total: number }) {
  const r = 70;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, total)) / 100) * circumference;
  return (
    <div className="relative size-44 shrink-0" role="img" aria-label={`Score: ${total} out of 100`}>
      <svg viewBox="0 0 160 160" className="size-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" strokeWidth="5" className="stroke-foreground/10" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className="stroke-violet"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-6xl leading-none tabular-nums">{total}</span>
        <span className="pt-1 text-xs tracking-[0.2em] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
