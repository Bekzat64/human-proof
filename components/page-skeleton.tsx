import { ProofShell } from "@/components/proof/proof-shell";

/**
 * Loading state for the credential-style pages while their data streams in.
 * Shaped like a page (eyebrow, serif title, a few blocks) so the layout does
 * not jump when the content arrives.
 */
export function PageSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <ProofShell>
      <div role="status" aria-live="polite" className="flex flex-col gap-8">
        <span className="sr-only">{label}</span>
        <div aria-hidden className="flex flex-col gap-4">
          <div className="h-3 w-40 animate-pulse rounded bg-foreground/10" />
          <div className="h-12 w-3/4 animate-pulse rounded-lg bg-foreground/10" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-foreground/10" />
        </div>
        <div aria-hidden className="grid gap-4 sm:grid-cols-2">
          <div className="h-36 animate-pulse rounded-xl bg-foreground/[0.06]" />
          <div className="h-36 animate-pulse rounded-xl bg-foreground/[0.06]" />
        </div>
        <div aria-hidden className="h-48 animate-pulse rounded-xl bg-foreground/[0.06]" />
      </div>
    </ProofShell>
  );
}
