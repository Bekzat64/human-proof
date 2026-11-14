import type { Metadata } from "next";
import Link from "next/link";
import { ProofShell } from "@/components/proof/proof-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <ProofShell>
      <section className="flex flex-col items-start gap-6">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="font-display text-5xl leading-tight text-balance sm:text-6xl">Nothing to verify here</h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          This link doesn&apos;t lead to a page. If someone sent you a proof, check the address: a proof link looks
          like <span className="font-mono text-[0.85rem] text-foreground">/p/</span> followed by a short code. A
          simulation still in progress is visible only in the browser that started it.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/">Go to the home page</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/drill">Take the 3-minute drill</Link>
          </Button>
        </div>
      </section>
    </ProofShell>
  );
}
