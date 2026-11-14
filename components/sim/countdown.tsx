"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Milliseconds left in the simulation, ticking once a second. Negative once
 * time is up. `remainingAtLoadMs` comes from the server clock; from then on
 * we count locally with the monotonic clock, so a wrong system clock on the
 * candidate's machine does not matter.
 */
export function useCountdown(remainingAtLoadMs: number): number {
  const [remainingMs, setRemainingMs] = useState(remainingAtLoadMs);

  useEffect(() => {
    const deadline = performance.now() + remainingAtLoadMs;
    const tick = () => setRemainingMs(deadline - performance.now());
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [remainingAtLoadMs]);

  return remainingMs;
}

function clock(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function Countdown({ remainingMs }: { remainingMs: number }) {
  const over = remainingMs <= 0;
  const low = !over && remainingMs <= 2 * 60 * 1000;

  return (
    <div
      role="timer"
      aria-label={over ? `Over time by ${clock(remainingMs)}` : `${clock(remainingMs)} remaining`}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-sm tabular-nums",
        over && "border-destructive/40 bg-destructive/10 text-destructive",
        low && "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      <Timer aria-hidden className="size-4" />
      {over ? `+${clock(remainingMs)}` : clock(remainingMs)}
    </div>
  );
}

export function TimeUpBanner() {
  return (
    <div
      role="status"
      className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive"
    >
      <strong className="font-semibold">Time&apos;s up.</strong> You can still submit — your answers
      will be recorded as over time.
    </div>
  );
}
