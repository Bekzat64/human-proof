import Link from "next/link";

/** Frame for the credential pages: navy theme, wordmark, quiet footer. */
export function ProofShell({
  children,
  demo = false,
  banner,
}: {
  children: React.ReactNode;
  demo?: boolean;
  banner?: React.ReactNode;
}) {
  return (
    <div className="credential relative flex flex-1 flex-col">
      {banner}
      {demo && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center overflow-hidden"
        >
          <span className="-rotate-[24deg] font-display text-[26vw] leading-none text-foreground/[0.06] select-none">
            DEMO
          </span>
        </div>
      )}
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 pt-8">
        <Link href="/" className="text-xs font-semibold tracking-[0.28em] text-foreground/90 hover:text-foreground">
          HUMAN PROOF
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/drill" className="hover:text-foreground">
            Drill
          </Link>
          <Link href="/me" className="hover:text-foreground">
            My proofs
          </Link>
        </nav>
      </header>
      {demo && (
        <div className="mx-auto w-full max-w-3xl px-6 pt-5">
          <span className="inline-block rounded-full border border-destructive/60 px-3 py-1 text-xs font-medium tracking-wide text-destructive">
            DEMO — not a real candidate
          </span>
        </div>
      )}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-20 px-6 pt-14 pb-24">{children}</main>
      <footer className="mx-auto w-full max-w-3xl border-t px-6 py-8 text-xs leading-relaxed text-muted-foreground">
        HUMAN PROOF is a 15-minute analyst work simulation. The AI copilot in it is deliberately seeded
        with mistakes; this page records which ones were caught. No account is involved: a proof is
        tied to the browser that took the simulation.
        <nav className="flex gap-5 pt-4">
          <Link href="/stats" className="hover:text-foreground">
            Stats
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
        </nav>
      </footer>
    </div>
  );
}

/** Section heading used down the page: small eyebrow, serif title. */
export function SectionHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">{eyebrow}</p>
        <h2 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

export function EstimatedTag() {
  return (
    <span
      title="Scored by rules, not yet reviewed by a model"
      className="rounded-full border border-dashed border-foreground/30 px-2 py-0.5 text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase"
    >
      estimated
    </span>
  );
}
