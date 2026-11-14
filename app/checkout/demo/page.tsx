import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { ProofShell } from "@/components/proof/proof-shell";
import { Button } from "@/components/ui/button";
import { PASS_DAYS } from "@/lib/pass";
import { isStripeEnabled } from "@/lib/stripe";

export const metadata: Metadata = { title: "Demo checkout", robots: { index: false } };

// Whether Stripe is configured is read per request, so adding a key needs no rebuild of this page.
export const dynamic = "force-dynamic";

/** Stand-in for Stripe Checkout while no Stripe key is configured. Says plainly that nothing is charged. */
export default function DemoCheckoutPage() {
  if (isStripeEnabled()) notFound();
  return (
    <ProofShell>
      <section className="flex flex-col items-start gap-6">
        <p className="flex items-center gap-2 rounded-full border border-dashed border-foreground/40 px-3 py-1 text-sm font-medium">
          <FlaskConical aria-hidden className="size-4 text-violet" /> Test mode — no real charge
        </p>
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">Demo checkout</h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          Payments are not connected in this build, so this page stands in for Stripe Checkout. Activating creates a
          {` ${PASS_DAYS}`}-day Job-Search Pass for this browser exactly as a paid checkout would. Nothing is charged,
          and no card or personal details are asked for.
        </p>
        <dl className="grid w-full max-w-md grid-cols-2 gap-y-3 rounded-xl border bg-card p-6 text-sm">
          <dt className="text-muted-foreground">Item</dt>
          <dd>Job-Search Pass, {PASS_DAYS} days</dd>
          <dt className="text-muted-foreground">Price</dt>
          <dd>
            $19.00 <span className="text-muted-foreground">(not charged)</span>
          </dd>
        </dl>
        <div className="flex flex-wrap gap-3">
          <form action="/api/checkout/demo" method="post">
            <Button type="submit" size="lg">
              Activate test pass
            </Button>
          </form>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">Cancel</Link>
          </Button>
        </div>
      </section>
    </ProofShell>
  );
}
