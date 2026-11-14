import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Flag } from "lucide-react";
import { StartButton } from "@/components/start-button";
import { Button } from "@/components/ui/button";
import { getAttempt } from "@/lib/attempts";
import type { Score } from "@/lib/grading/types";

export const metadata: Metadata = {
  title: { absolute: "HUMAN PROOF — AI can do the task. Prove you can direct it." },
  description:
    "For US analysts on the job hunt. Work beside an AI copilot that makes subtle mistakes, catch them, and share a proof page employers can verify. No sign-up.",
};

// Static and fast; the example proof's numbers are re-read every 10 minutes.
export const revalidate = 600;

/** The example proof linked from the landing page (seeded by `pnpm seed:demo`). */
const EXAMPLE_PROOF_ID = "demo-advanced";
const REPO_URL = "https://github.com/Bekzat64/human-proof";

const STEPS = [
  {
    title: "Work with an AI copilot that makes subtle mistakes",
    body: "A real brief from your manager, a data table and 15 minutes. The copilot is fast, confident and, a few times, wrong in ways that look right.",
  },
  {
    title: "Catch them and make the call",
    body: "Check its numbers against the data, flag what is wrong, and answer in your own words: the figure, the cause, the recommendation.",
  },
  {
    title: "Share a proof page employers can verify",
    body: "Your score, every AI error you caught or missed, and a replay of how you worked, at a public link anyone can check.",
  },
];

export default async function Home() {
  // The example proof is read live, so the numbers shown are the ones on that page.
  const example = await getAttempt(EXAMPLE_PROOF_ID).catch(() => null);
  const exampleScore = example?.status === "graded" ? (example.score as Score | null) : null;

  return (
    <div className="credential flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 pt-8">
        <Link href="/" className="text-xs font-semibold tracking-[0.28em]">
          HUMAN PROOF
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/drill" className="hover:text-foreground">
            Drill
          </Link>
          <Link href="/stats" className="hover:text-foreground">
            Stats
          </Link>
          <Link href="/me" className="hover:text-foreground">
            My proofs
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-6 pt-16 pb-24 sm:pt-24">
        <section className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-7">
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              For US analysts on the job hunt
            </p>
            <h1 className="font-display text-5xl leading-[1.02] text-balance sm:text-7xl">
              AI can do the task. <span className="text-violet">Prove you can direct it.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
              Every resume says &ldquo;proficient in AI&rdquo;, and hiring managers can&apos;t tell who is. Work beside
              an AI copilot that slips in subtle mistakes, and walk away with evidence of how you handled them.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
              <Button asChild size="lg" className="h-11 px-5 text-base">
                <Link href="/drill">
                  Take the 3-minute drill <ArrowRight aria-hidden />
                </Link>
              </Button>
              <StartButton kind="sim" variant="outline" className="[&_button]:h-11 [&_button]:px-5 [&_button]:text-base">
                Start the 15-minute simulation
              </StartButton>
            </div>
            <p className="text-sm text-muted-foreground">No sign-up. No login. Free to try.</p>
          </div>

          <Specimen />
        </section>

        <section aria-labelledby="how" className="flex flex-col gap-10">
          <h2 id="how" className="font-display text-4xl sm:text-5xl">
            How it works
          </h2>
          <ol className="grid gap-10 border-t pt-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3">
                <span className="font-display text-5xl leading-none text-violet">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-lg font-medium text-balance">{step.title}</h3>
                <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-6 rounded-2xl border bg-card p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">What employers see</p>
            <h2 className="font-display text-3xl text-balance sm:text-4xl">
              {exampleScore
                ? `${exampleScore.level}, ${exampleScore.total}/100 — caught ${exampleScore.dimensions.aiJudgment.caught} of ${exampleScore.dimensions.aiJudgment.exposed} AI errors`
                : "A score, the AI errors caught, and how the work was done"}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              An example proof from a demo candidate, marked DEMO on the page. Open it to see what a hiring manager
              gets: each AI error with what was true, the score breakdown, and the process replay.
            </p>
          </div>
          <Button asChild size="lg" variant="outline" className="h-11 px-5">
            <Link href={`/p/${EXAMPLE_PROOF_ID}`}>
              See an example proof <ArrowRight aria-hidden />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t px-6 py-8 text-sm text-muted-foreground">
        <span>HUMAN PROOF · built in 24 hours</span>
        <nav className="flex flex-wrap gap-5">
          <Link href="/stats" className="hover:text-foreground">
            Stats
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
            Source <ArrowUpRight aria-hidden className="size-3.5" />
          </a>
        </nav>
      </footer>
    </div>
  );
}

/**
 * One moment from a simulation, drawn as the product draws it: the copilot's
 * opening line with its seeded error, and the candidate's flag. Labelled as an
 * example; the figures are internally consistent (6,450 ÷ 71,753 = 8.99%).
 */
function Specimen() {
  return (
    <figure className="relative flex flex-col gap-4" aria-label="Example: a copilot mistake being flagged">
      <div className="rounded-2xl border bg-card p-6 shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between gap-3 pb-4">
          <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">AI copilot</span>
          <span className="text-xs text-muted-foreground">Example</span>
        </div>
        <p className="text-[0.95rem] leading-relaxed">
          I ran a quick analysis of the table to get you started.{" "}
          <mark className="rounded-sm bg-violet/15 px-0.5 text-foreground underline decoration-violet decoration-wavy decoration-1 underline-offset-4">
            September churn was 8.0%: 6,450 cancellations across 80,321 subscribers.
          </mark>{" "}
          Keep in mind September was the promo month, so a lot of new subscribers came in.
        </p>
      </div>
      <div className="ml-6 flex flex-col gap-2 rounded-2xl border border-violet/50 bg-violet/[0.08] p-5 sm:ml-12">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Flag aria-hidden className="size-4 text-violet" /> You flagged it
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          80,321 is end-of-month subscribers. Churn is cancellations over the{" "}
          <span className="text-foreground">start</span> of the month: 6,450 ÷ 71,753 = 8.99%.
        </p>
      </div>
      <figcaption className="ml-6 text-xs text-muted-foreground sm:ml-12">
        Caught by flag and by answer: full credit on the proof.
      </figcaption>
    </figure>
  );
}
