import type { Metadata } from "next";
import Link from "next/link";
import { ProofShell } from "@/components/proof/proof-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Daily drill",
  description: "Five short AI answers a day. Find the sentence that is wrong. Three minutes.",
};

/** Placeholder: the drill itself ships with Stage 5. */
export default function DrillPage() {
  return (
    <ProofShell>
      <section className="flex flex-col items-start gap-6">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Daily drill</p>
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">Daily drill — coming in a moment</h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          Five short AI answers, three minutes: find the sentence that is wrong and say why. It is being built
          right now and is not available yet. The full 15-minute simulation is.
        </p>
        <div className="flex flex-wrap gap-3">
          {/* POST, not a link: starting an attempt must be a deliberate action. */}
          <form action="/sim/new" method="post">
            <Button type="submit" size="lg">
              Start the 15-minute simulation
            </Button>
          </form>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </section>
    </ProofShell>
  );
}
