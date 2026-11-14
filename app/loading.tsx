import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 aria-hidden className="size-4 animate-spin" />
      Loading…
    </main>
  );
}
