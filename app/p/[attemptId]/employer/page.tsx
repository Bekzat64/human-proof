import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FeedbackForm } from "@/components/proof/feedback-form";
import { IntegrityNotes } from "@/components/proof/integrity-notes";
import { EstimatedTag, ProofShell, SectionHeading } from "@/components/proof/proof-shell";
import { TrapCards } from "@/components/proof/trap-cards";
import type { Score } from "@/lib/grading/types";
import { employerBullets, falseFlags, otherFlags, verdictLine } from "@/lib/proof/employer";
import { existingVerdict, getProofAttempt, loadProof } from "@/lib/proof/load";
import { CREDENTIAL_NAME, formatDate, validUntil } from "@/lib/proof/share";
import { getBaseUrl } from "@/lib/site-url";

type Props = { params: Promise<{ attemptId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { attemptId } = await params;
  const attempt = await getProofAttempt(attemptId);
  if (!attempt || attempt.kind !== "sim" || attempt.status !== "graded" || !attempt.score) {
    return { title: "Employer view", robots: { index: false } };
  }
  const score = attempt.score as Score;
  return {
    metadataBase: new URL(await getBaseUrl()),
    title: `Employer view — ${score.level} · ${score.total}/100${attempt.isDemo ? " (DEMO)" : ""}`,
    description: verdictLine(score),
    // A working page for one reader, not something to index.
    robots: { index: false },
  };
}

/** The short version for a hiring manager: verdict, three bullets, key moments, and a way to answer. */
export default async function EmployerPage({ params }: Props) {
  const { attemptId } = await params;
  const access = await loadProof(attemptId);
  // Unlike the Proof page there is no "pending" view here: ungraded is a 404 for everyone.
  if (access.kind !== "graded") notFound();

  const { attempt, score, isOwner, anonId } = access;
  const existing = isOwner ? null : await existingVerdict(attempt.id, anonId);
  const { bullets, estimated } = employerBullets(score);
  const wrongFlags = falseFlags(score);
  const neutralFlags = otherFlags(score);
  const issued = attempt.submittedAt ?? attempt.startedAt;

  return (
    <ProofShell
      demo={attempt.isDemo}
      banner={
        isOwner ? (
          <div className="border-b border-violet/40 bg-violet/10 px-6 py-3 text-center text-sm">
            This is the view employers get. Send them this page&apos;s address.
          </div>
        ) : undefined
      }
    >
      <section className="flex flex-col gap-6">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Employer view · {CREDENTIAL_NAME}
        </p>
        <h1 className="font-display text-4xl leading-tight text-balance sm:text-5xl">{verdictLine(score)}</h1>
        <p className="text-sm text-muted-foreground">
          Credential <span className="font-mono text-[0.82rem]">{attempt.id}</span> · issued {formatDate(issued)} ·
          valid until {formatDate(validUntil(issued))} ·{" "}
          <Link href={`/p/${attempt.id}`} className="text-violet underline-offset-4 hover:underline">
            full proof
          </Link>
        </p>
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Summary" title="Three things to know" aside={estimated ? <EstimatedTag /> : undefined} />
        <ol className="flex flex-col divide-y rounded-xl border bg-card">
          {bullets.map((bullet, i) => (
            <li key={bullet} className="flex gap-5 px-6 py-5">
              <span className="font-display text-2xl leading-none text-violet">{i + 1}</span>
              <span className="text-sm leading-relaxed text-pretty">{bullet}</span>
            </li>
          ))}
        </ol>
        {estimated && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Estimated: these bullets are built only from results that are computed, not judged (answers, flags,
            session log). The written recommendation has not yet been reviewed by a model, so it is left out.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Key moments" title="When the AI was wrong" />
        <TrapCards traps={score.traps} compact />
        <p className="text-sm text-muted-foreground">
          {wrongFlags === 0
            ? "False flags: 0. No correct AI answer was flagged as wrong."
            : `False flags: ${wrongFlags}. Flagged ${wrongFlags} correct AI ${wrongFlags === 1 ? "answer" : "answers"} as wrong.`}
          {neutralFlags > 0 && ` Flagged ${neutralFlags} other ${neutralFlags === 1 ? "reply" : "replies"}.`}
        </p>
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Integrity notes" title="What was observed" />
        <IntegrityNotes notes={score.integrityNotes} />
      </section>

      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Your call" title="Would you interview this person?" />
        <FeedbackForm attemptId={attempt.id} existing={existing} isOwner={isOwner} />
      </section>

      <Link
        href={`/p/${attempt.id}`}
        className="flex items-center gap-1.5 self-start text-sm text-violet underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" /> Back to the full proof
      </Link>
    </ProofShell>
  );
}
