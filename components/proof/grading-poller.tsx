"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_EVERY_MS = 1500;
const GIVE_UP_AFTER = 40; // about a minute

/** Shown while an attempt is being graded; reloads the page once it is. */
export function GradingPoller({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let tries = 0;
    let stopped = false;
    let timer: number | undefined;

    async function poll() {
      tries++;
      try {
        const response = await fetch(`/api/attempts/${attemptId}/status`, { cache: "no-store" });
        const body = (await response.json()) as { status?: string };
        if (stopped) return;
        if (body.status === "graded") return router.refresh();
      } catch {
        // network blip: keep polling
      }
      if (stopped) return;
      if (tries >= GIVE_UP_AFTER) return setFailed(true);
      timer = window.setTimeout(poll, POLL_EVERY_MS);
    }
    timer = window.setTimeout(poll, 400);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [attemptId, router]);

  if (failed) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Grading is taking longer than expected. Your answers are saved — reload this page in a
        minute.
      </p>
    );
  }
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 aria-hidden className="size-4 animate-spin" /> Grading your answers…
    </p>
  );
}
