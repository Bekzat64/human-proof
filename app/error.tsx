"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { ProofShell } from "@/components/proof/proof-shell";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ProofShell>
      <section className="flex flex-col items-start gap-6">
        <p className="font-mono text-sm text-muted-foreground">Error</p>
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">Something went wrong</h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          That one is on us, not you. Anything you already submitted is saved. Try again, or head back to the home
          page.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => retry()}>
            Try again
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </section>
    </ProofShell>
  );
}
