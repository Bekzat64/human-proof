import { Check, X } from "lucide-react";
import { cn } from "cn";
import { REASON_LABELS, type DrillItem, type DrillItemResult } from "@/lib/drill/types";
import { DrillTable } from "./drill-table";

/** After submit, for the owner only: each item with their pick, the truth and why. */
export function DrillReview({ items, results }: { items: DrillItem[]; results: DrillItemResult[] }) {
  return (
    <ol className="flex flex-col gap-6">
      {items.map((item, n) => {
        const result = results.find((r) => r.itemId === item.id);
        if (!result) return null;
        const pickLabel =
          result.pickedSentence === null
            ? "No answer"
            : result.pickedSentence === "none"
              ? "Nothing wrong"
              : `Sentence ${result.pickedSentence + 1}${result.pickedReason ? ` · ${REASON_LABELS[result.pickedReason]}` : " · no reason given"}`;
        const truthLabel =
          result.truthSentence === "none"
            ? "Nothing wrong"
            : `Sentence ${result.truthSentence + 1} · ${REASON_LABELS[result.truthReason]}`;
        return (
          <li key={item.id} className="flex flex-col gap-5 rounded-xl border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                Item {n + 1} · {item.domain}
              </span>
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  result.sentenceCorrect
                    ? "bg-primary text-primary-foreground"
                    : "border border-dashed border-foreground/30 text-muted-foreground",
                )}
              >
                {result.sentenceCorrect ? <Check aria-hidden className="size-3.5" /> : <X aria-hidden className="size-3.5" />}
                {result.points} / 20
              </span>
            </div>
            <p className="text-sm leading-relaxed text-pretty">{item.context}</p>
            <DrillTable table={item.table} />
            <ul className="flex flex-col gap-2">
              {item.sentences.map((sentence, i) => {
                const isTruth = result.truthSentence === i;
                const isPick = result.pickedSentence === i;
                return (
                  <li
                    key={i}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border px-4 py-3 text-sm leading-relaxed",
                      isTruth && "border-violet bg-violet/10",
                      !isTruth && isPick && "border-dashed border-foreground/40",
                    )}
                  >
                    <span>{sentence}</span>
                    {(isTruth || isPick) && (
                      <span className="text-xs text-muted-foreground">
                        {isTruth && "The wrong sentence"}
                        {isTruth && isPick && " · your pick"}
                        {!isTruth && isPick && "Your pick: this sentence is fine"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <dl className="grid gap-4 border-t pt-5 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Your pick</dt>
                <dd>{pickLabel}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">Truth</dt>
                <dd>{truthLabel}</dd>
              </div>
            </dl>
            <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{item.explanation}</p>
          </li>
        );
      })}
    </ol>
  );
}
