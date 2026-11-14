import type { Metadata } from "next";
import Link from "next/link";
import { ProofShell } from "@/components/proof/proof-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Job-Search Pass",
  description: "Unlimited simulations and the full process replay on your proof.",
};

/** Placeholder: checkout ships with Stage 6. Nothing can be bought here yet, and the page says so. */
export default function PricingPage() {
  return (
    <ProofShell>
      <section className="flex flex-col items-start gap-6">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Job-Search Pass</p>
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">The pass is not on sale yet</h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          The Job-Search Pass will unlock the full process replay on your proof and unlimited simulations.
          Checkout is still being built, so nothing can be purchased here today. One simulation and its proof
          page are free.
        </p>
        <Button asChild size="lg" variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </section>
    </ProofShell>
  );
}
