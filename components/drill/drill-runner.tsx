"use client";

import { ArrowLeft, ArrowRight, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { useCountdown } from "@/components/sim/countdown";
import { Button } from "@/components/ui/button";
import { errorMessageFrom } from "@/lib/api";
import { DRILL_REASONS, REASON_LABELS, type DrillAnswer, type DrillReason, type PublicDrillItem } from "@/lib/drill/types";
import { DrillTable } from "./drill-table";

type Pick = { sentence: number | "none" | null; reason: DrillReason | null };
const EMPTY: Pick = { sentence: null, reason: null };
const FLAW_REASONS = DRILL_REASONS.filter((reason) => reason !== "none");

const clock = (ms: number) => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};

/**
 * The running drill: one item at a time, a 3-minute clock, and a submit that
 * fires on its own when the clock runs out. It holds picks only; it was never
 * given the answers.
 */
export function DrillRunner({
  attemptId,
  items,
  remainingAtLoadMs,
}: {
  attemptId: string;
  items: PublicDrillItem[];
  remainingAtLoadMs: number;
}) {
  const router = useRouter();
  const remainingMs = useCountdown(remainingAtLoadMs);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Time spent with each item on screen.
  const spent = useRef<Record<string, number>>({});
  const shownSince = useRef<number | null>(null);
  const submitted = useRef(false);

  const item = items[index];
  const pick = picks[item.id] ?? EMPTY;
  const answered = (p: Pick | undefined) => !!p && (p.sentence === "none" || (p.sentence !== null && p.reason !== null));
  const answeredCount = items.filter((i) => answered(picks[i.id])).length;

  const settleTime = useCallback(
    (itemId: string) => {
      const now = performance.now();
      if (shownSince.current !== null) spent.current[itemId] = (spent.current[itemId] ?? 0) + (now - shownSince.current);
      shownSince.current = now;
    },
    [],
  );

  useEffect(() => {
    shownSince.current = performance.now();
  }, []);

  const go = (next: number) => {
    settleTime(item.id);
    setIndex(next);
  };

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    settleTime(items[index].id);
    setPending(true);
    setError(null);
    const answers: DrillAnswer[] = items.map((i) => ({
      itemId: i.id,
      sentence: picks[i.id]?.sentence ?? null,
      reason: picks[i.id]?.reason ?? null,
      ms: Math.round(spent.current[i.id] ?? 0),
    }));
    try {
      const response = await fetch("/api/drill/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, answers }),
      });
      if (!response.ok) throw new Error(await errorMessageFrom(response, "Your drill could not be submitted."));
      router.replace(`/drill/${attemptId}`);
      router.refresh();
      // Same URL, so the router keeps the scroll position: start the result at its headline.
      window.scrollTo({ top: 0 });
    } catch (e) {
      submitted.current = false;
      setPending(false);
      setError(e instanceof Error ? e.message : "Your drill could not be submitted. Check your connection and try again.");
    }
  }, [attemptId, index, items, picks, router, settleTime]);

  // Time is up: submit whatever has been picked.
  const timeUp = remainingMs <= 0;
  useEffect(() => {
    if (!timeUp) return;
    const timer = window.setTimeout(() => void submit(), 0);
    return () => window.clearTimeout(timer);
  }, [timeUp, submit]);

  const setPick = (next: Pick) => setPicks((all) => ({ ...all, [item.id]: next }));
  const last = index === items.length - 1;

  return (
    <div className="flex flex-col gap-8">
      <div className="sticky top-0 z-10 -mx-6 flex items-center justify-between gap-4 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2" aria-label={`Item ${index + 1} of ${items.length}`}>
          {items.map((i, n) => (
            <button
              key={i.id}
              type="button"
              onClick={() => go(n)}
              aria-label={`Go to item ${n + 1}${answered(picks[i.id]) ? " (answered)" : ""}`}
              aria-current={n === index ? "step" : undefined}
              className={cn(
                "flex size-8 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors",
                n === index && "border-violet text-violet",
                n !== index && answered(picks[i.id]) && "border-transparent bg-violet/20 text-foreground",
                n !== index && !answered(picks[i.id]) && "text-muted-foreground hover:text-foreground",
              )}
            >
              {n + 1}
            </button>
          ))}
        </div>
        <div
          role="timer"
          aria-label={`${clock(remainingMs)} remaining`}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-sm tabular-nums",
            remainingMs <= 30_000 && "border-destructive/50 text-destructive",
          )}
        >
          <Timer aria-hidden className="size-4" />
          {clock(remainingMs)}
        </div>
      </div>

      <section className="flex flex-col gap-6" aria-live="polite">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Item {index + 1} of {items.length} · {item.domain}
          </p>
          <p className="text-lg leading-relaxed text-pretty">{item.context}</p>
        </div>

        <DrillTable table={item.table} />

        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">The AI answered. Click the sentence that is wrong:</p>
          <div className="flex flex-col gap-2">
            {item.sentences.map((sentence, n) => (
              <button
                key={n}
                type="button"
                aria-pressed={pick.sentence === n}
                onClick={() => setPick({ sentence: n, reason: pick.sentence === "none" ? null : pick.reason })}
                className={cn(
                  "rounded-lg border bg-card px-4 py-3 text-left text-sm leading-relaxed transition-colors hover:border-violet/60",
                  pick.sentence === n && "border-violet bg-violet/10",
                )}
              >
                {sentence}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={pick.sentence === "none"}
              onClick={() => setPick({ sentence: "none", reason: "none" })}
              className={cn(
                "rounded-lg border border-dashed px-4 py-3 text-left text-sm font-medium transition-colors hover:border-violet/60",
                pick.sentence === "none" && "border-solid border-violet bg-violet/10",
              )}
            >
              Nothing wrong: every sentence holds up
            </button>
          </div>
        </div>

        {typeof pick.sentence === "number" && (
          <fieldset className="flex flex-col gap-3">
            <legend className="pb-3 text-sm text-muted-foreground">Why is it wrong?</legend>
            <div className="flex flex-wrap gap-2">
              {FLAW_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  aria-pressed={pick.reason === reason}
                  onClick={() => setPick({ ...pick, reason })}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition-colors hover:border-violet/60",
                    pick.reason === reason && "border-violet bg-violet/10 text-foreground",
                  )}
                >
                  {REASON_LABELS[reason]}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </section>

      {/* Sticks to the bottom of the screen, so Next stays in reach on short screens. */}
      <div className="sticky bottom-0 z-10 -mx-6 flex flex-col gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="lg" disabled={index === 0 || pending} onClick={() => go(index - 1)}>
            <ArrowLeft aria-hidden /> Back
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {answeredCount} of {items.length} answered
          </span>
          {last || answeredCount === items.length ? (
            <Button size="lg" disabled={pending} onClick={() => void submit()}>
              {pending ? "Scoring…" : "Submit drill"}
            </Button>
          ) : (
            <Button size="lg" disabled={pending} onClick={() => go(index + 1)}>
              Next <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
