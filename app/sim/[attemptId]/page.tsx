import { Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SimWorkspace } from "@/components/sim/sim-workspace";
import { getAnonId } from "@/lib/anon";
import { getAttempt, loadChat, remainingMs } from "@/lib/attempts";
import type { Attempt } from "@/lib/db/schema";
import { buildVariant } from "@/lib/variant";

export const metadata: Metadata = {
  title: "Simulation",
  robots: { index: false, follow: false },
};

/**
 * The simulation, for the attempt's owner only. Anyone else gets a 404 —
 * or the public Proof page once the attempt has been graded.
 *
 * The access check runs before anything is streamed (there is deliberately no
 * loading.tsx on this route), so a stranger receives a real HTTP 404 rather
 * than a 200 with a not-found screen. The loading state is the Suspense
 * fallback below, shown only once the visitor is known to be the owner.
 */
export default async function SimPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const [attempt, anonId] = await Promise.all([getAttempt(attemptId), getAnonId()]);
  if (!attempt || attempt.kind !== "sim") notFound();

  const proofPage = `/p/${attempt.id}`;
  if (attempt.anonId !== anonId) {
    if (attempt.status === "graded") redirect(proofPage);
    notFound();
  }
  if (attempt.status !== "active") redirect(proofPage);

  return (
    <Suspense fallback={<SimLoading />}>
      <Simulation attempt={attempt} />
    </Suspense>
  );
}

async function Simulation({ attempt }: { attempt: Attempt }) {
  // Only `publicData` leaves the server: the answers and the copilot's seeded
  // claims stay in the variant object and are never passed to a client component.
  const { publicData } = buildVariant(attempt.seed);
  const chat = await loadChat(attempt.id);

  return (
    <SimWorkspace
      attemptId={attempt.id}
      publicData={publicData}
      initialMessages={chat.messages}
      initialFlags={chat.flags}
      remainingAtLoadMs={remainingMs(attempt)}
    />
  );
}

function SimLoading() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex h-dvh flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
    >
      <Loader2 aria-hidden className="size-5 animate-spin" />
      Setting up your simulation…
    </main>
  );
}
