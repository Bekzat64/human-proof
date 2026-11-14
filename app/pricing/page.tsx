import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock, Lock } from "lucide-react";
import { ProofShell } from "@/components/proof/proof-shell";
import { StartButton } from "@/components/start-button";
import { Button } from "@/components/ui/button";
import { getAnonId } from "@/lib/anon";
import { activePass, PASS_DAYS } from "@/lib/pass";
import { formatDate } from "@/lib/proof/share";
import { isStripeEnabled } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free: the daily drill, one full simulation and a proof page. Job-Search Pass: $19 a week.",
};

const FREE = [
  "Daily 3-minute drill, every day",
  "1 full 15-minute simulation",
  "Public proof page with score and AI errors caught",
  "Employer view link to send to hiring managers",
];
const PASS = ["Unlimited simulations", "Full process replay on your proofs", "New scenarios first, as they ship"];

const NOTICES: Record<string, { tone: "ok" | "info" | "error"; text: string }> = {
  success: { tone: "ok", text: "Your Job-Search Pass is active." },
  already_active: { tone: "info", text: "You already have an active pass." },
  cancelled: { tone: "info", text: "Checkout cancelled. Nothing was charged." },
  unpaid: { tone: "error", text: "That checkout was not completed, so no pass was created." },
  error: { tone: "error", text: "Checkout could not be completed. Nothing was charged; try again in a moment." },
};

type Props = { searchParams: Promise<{ checkout?: string; reason?: string }> };

async function PricingContent({ searchParams }: Props) {
  const { checkout, reason } = await searchParams;
  const pass = await activePass(await getAnonId());
  const notice = checkout ? NOTICES[checkout] : undefined;
  const stripe = isStripeEnabled();

  return (
    <ProofShell>
      {reason === "sim_limit" && !pass && (
        <section className="flex flex-col gap-3 rounded-xl border border-violet/50 bg-violet/[0.07] p-6" aria-label="Simulation limit">
          <p className="flex items-center gap-2 font-medium">
            <Lock aria-hidden className="size-4 text-violet" /> You have used your free simulation
          </p>
          <p className="text-sm text-pretty text-muted-foreground">
            Your first proof is yours to keep. Another simulation needs the Job-Search Pass. The daily drill stays
            free.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <form action="/api/checkout" method="post">
              <Button type="submit">Get the pass — $19 / 7 days</Button>
            </form>
            <Button asChild variant="outline">
              <Link href="/drill">Take today&apos;s drill instead</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/me">See my proofs</Link>
            </Button>
          </div>
        </section>
      )}

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={
            notice.tone === "error"
              ? "rounded-xl border border-destructive/50 p-4 text-sm text-destructive"
              : "rounded-xl border p-4 text-sm"
          }
        >
          {notice.text}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Pricing</p>
        <h1 className="font-display text-5xl leading-tight text-balance sm:text-6xl">Practice free. Pay when you are job-searching.</h1>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-6 rounded-xl border bg-card p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-medium">Free</h2>
            <p className="font-display text-4xl">$0</p>
          </div>
          <Features items={FREE} />
          <Button asChild size="lg" variant="outline" className="mt-auto">
            <Link href="/drill">Take today&apos;s drill</Link>
          </Button>
        </section>

        <section className="flex flex-col gap-6 rounded-xl border border-violet/60 bg-card p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-medium">Job-Search Pass</h2>
            <p className="font-display text-4xl">
              $19 <span className="font-sans text-base text-muted-foreground">/ week</span>
            </p>
          </div>
          <Features items={PASS} />
          <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              ID-verified proof — <em>coming soon</em>. On the roadmap, not in the pass today.
            </span>
          </p>
          <div className="mt-auto flex flex-col gap-3">
            {pass ? (
              <>
                <p className="rounded-lg border border-violet/50 p-3 text-sm">
                  Pass active until {formatDate(pass.expiresAt)}.
                </p>
                <StartButton kind="sim" size="lg">
                  Start a simulation
                </StartButton>
              </>
            ) : (
              <form action="/api/checkout" method="post">
                <Button type="submit" size="lg" className="w-full">
                  Get the pass — {PASS_DAYS} days
                </Button>
              </form>
            )}
            <p className="text-xs text-muted-foreground">
              {stripe
                ? "Stripe test mode: use card 4242 4242 4242 4242, any future date, any CVC. No real charge."
                : "Payments are in test mode in this build: checkout is a labelled demo and nothing is charged."}{" "}
              No account: the pass belongs to this browser.
            </p>
          </div>
        </section>
      </div>
    </ProofShell>
  );
}

function Features({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-violet" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function PricingPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading pricing…" />}>
      <PricingContent {...props} />
    </Suspense>
  );
}
