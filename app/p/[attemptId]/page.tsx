import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnonId } from "@/lib/anon";
import { getAttempt } from "@/lib/attempts";
import { SIM_DURATION_MS } from "@/lib/sim-config";

export const metadata: Metadata = { title: "Proof" };

const duration = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)} min ${totalSeconds % 60} s`;
};

/**
 * Public Proof page — PLACEHOLDER. Grading lands in Stage 3 and the real page
 * in Stage 4; until then this only states, truthfully, where the attempt is.
 */
export default async function ProofPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const [attempt, anonId] = await Promise.all([getAttempt(attemptId), getAnonId()]);
  if (!attempt || attempt.kind !== "sim") notFound();

  const isOwner = attempt.anonId === anonId;

  // An attempt that is still running has nothing public to show.
  if (attempt.status === "active") {
    if (!isOwner) notFound();
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

  const elapsedMs = (attempt.submittedAt ?? attempt.startedAt).getTime() - attempt.startedAt.getTime();
  const overtimeMs = Math.max(0, elapsedMs - SIM_DURATION_MS);

  return (
    <Shell>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Answers submitted</CardTitle>
            <Badge variant="outline">Grading not live yet</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">
            {isOwner ? "Your answers are saved. " : ""}
            Automatic grading is still being built, so there is no score to show yet. This page will
            become the public Proof for this attempt.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
            <dt className="text-muted-foreground">Attempt</dt>
            <dd className="font-mono">{attempt.id}</dd>
            <dt className="text-muted-foreground">Time taken</dt>
            <dd>
              {duration(elapsedMs)}
              {overtimeMs > 0 && ` (${duration(overtimeMs)} over the 15-minute limit)`}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <Link href="/" className="text-sm font-semibold tracking-[0.2em]">
        HUMAN PROOF
      </Link>
      <main>{children}</main>
    </div>
  );
}
