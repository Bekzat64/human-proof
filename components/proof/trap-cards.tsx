import { cn } from "cn";
import type { TrapResult } from "@/lib/grading/types";
import { OUTCOME_LABELS } from "@/lib/proof/employer";

/** One card per AI mistake the candidate was actually shown. */
export function TrapCards({ traps, compact = false }: { traps: TrapResult[]; compact?: boolean }) {
  const shown = traps.filter((t) => t.exposed);
  const notShown = traps.length - shown.length;

  if (shown.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        The copilot made no seeded mistakes in this attempt, so there is nothing to catch here and AI
        judgment was not scored.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {shown.map((trap, i) => {
          const caught = trap.outcome !== "missed";
          return (
            <li key={trap.id} className="rounded-xl border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  AI error {i + 1} of {shown.length}
                </span>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    trap.outcome === "caught_by_flag_and_answer" && "bg-primary text-primary-foreground",
                    caught && trap.outcome !== "caught_by_flag_and_answer" && "border border-violet/60 text-violet",
                    !caught && "border border-dashed border-foreground/30 text-muted-foreground",
                  )}
                >
                  {OUTCOME_LABELS[trap.outcome]}
                </span>
              </div>
              <div className={cn("grid gap-6 pt-5", !compact && "sm:grid-cols-2")}>
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">What the AI said</p>
                  <p className="text-sm leading-relaxed text-pretty">“{trap.claimed}”</p>
                </div>
                <div className={cn("flex flex-col gap-2", !compact && "sm:border-l sm:pl-6")}>
                  <p className="text-xs text-muted-foreground">What was true</p>
                  <p className="text-sm leading-relaxed text-pretty">{trap.truth}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {notShown > 0 && (
        <p className="text-xs text-muted-foreground">
          {notShown} further seeded {notShown === 1 ? "mistake was" : "mistakes were"} not shown in this attempt
          and {notShown === 1 ? "is" : "are"} not counted.
        </p>
      )}
    </div>
  );
}
