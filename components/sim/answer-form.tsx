"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_DRAFT,
  answerSchema,
  countWords,
  draftToAnswerInput,
  type AnswerDraft,
} from "@/lib/answers";
import { errorMessageFrom } from "@/lib/api";
import type { EventLogger } from "@/lib/capture/event-logger";
import type { AnswerField } from "@/lib/events/schema";
import type { AnswerQuestion, Channel } from "@/lib/scenarios/types";
import { cn } from "@/lib/utils";

const EDIT_LOG_DELAY_MS = 3000;
const draftKey = (attemptId: string) => `hp:draft:${attemptId}`;

function readDraft(attemptId: string): AnswerDraft {
  try {
    const saved = window.localStorage.getItem(draftKey(attemptId));
    return saved ? { ...EMPTY_DRAFT, ...(JSON.parse(saved) as Partial<AnswerDraft>) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT; // storage blocked or corrupt: start empty
  }
}

type Props = {
  attemptId: string;
  questions: AnswerQuestion[];
  channels: readonly Channel[];
  logger: EventLogger;
};

/**
 * The four answers. The draft lives in localStorage keyed by attempt, so a
 * reload loses nothing. (Rendered client-only — see sim-workspace.tsx — so it
 * can read the saved draft on first render.)
 */
export default function AnswerForm({ attemptId, questions, channels, logger }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<AnswerDraft>(() => readDraft(attemptId));
  const [errors, setErrors] = useState<Partial<Record<AnswerField, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const editTimers = useRef(new Map<AnswerField, number>());
  useEffect(() => {
    const timers = editTimers.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  function update(field: AnswerField, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    setErrors((current) => ({ ...current, [field]: undefined }));
    try {
      window.localStorage.setItem(draftKey(attemptId), JSON.stringify(next));
    } catch {
      // storage unavailable: the form still works, it just will not survive a reload
    }

    // Log that the answer changed (length only) once typing pauses for 3s.
    window.clearTimeout(editTimers.current.get(field));
    editTimers.current.set(
      field,
      window.setTimeout(
        () => logger.log({ type: "answer_edit", payload: { field, chars: value.length } }),
        EDIT_LOG_DELAY_MS,
      ),
    );
  }

  // Record that something was pasted and how much — never what.
  const onPaste = (field: AnswerField) => (event: ClipboardEvent) =>
    logger.log({
      type: "paste",
      payload: { target: field, chars: event.clipboardData.getData("text").length },
    });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = answerSchema.safeParse(draftToAnswerInput(draft));
    if (!parsed.success) {
      const next: Partial<Record<AnswerField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as AnswerField;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await logger.flush(); // capture events must land before the attempt closes
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, answer: parsed.data }),
      });
      if (!response.ok) {
        setSubmitError(await errorMessageFrom(response, "Could not submit. Please try again."));
        setSubmitting(false);
        return;
      }
      const { redirectTo } = (await response.json()) as { redirectTo: string };
      window.localStorage.removeItem(draftKey(attemptId));
      router.push(redirectTo);
      return; // stay in the "Submitting…" state until the Proof page takes over
    } catch {
      setSubmitError("Could not reach the server. Check your connection and try again.");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="answers-heading" className="flex flex-col gap-5">
      <h2 id="answers-heading" className="text-base font-semibold">
        Your answers
      </h2>

      {questions.map((question, index) => {
        const field = question.id;
        const error = errors[field];
        const describedBy = `${field}-hint${error ? ` ${field}-error` : ""}`;
        const shared = {
          id: field,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy,
          onPaste: onPaste(field),
        };

        return (
          <div key={field} className="flex flex-col gap-1.5">
            <Label htmlFor={field}>
              {index + 1}. {question.label}
            </Label>

            {question.kind === "percent" && (
              <div className="flex items-center gap-2">
                <Input
                  {...shared}
                  inputMode="decimal"
                  placeholder="e.g. 7.4"
                  className="w-32"
                  value={draft[field]}
                  onChange={(e) => update(field, e.target.value)}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            )}

            {question.kind === "channel" && (
              <select
                {...shared}
                value={draft[field]}
                onChange={(e) => update(field, e.target.value)}
                className={cn(
                  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  error && "border-destructive",
                )}
              >
                <option value="">Choose a channel…</option>
                {channels.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            )}

            {question.kind === "text" && (
              <Textarea
                {...shared}
                rows={question.maxWords > 100 ? 6 : 4}
                value={draft[field]}
                onChange={(e) => update(field, e.target.value)}
              />
            )}

            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span id={`${field}-hint`}>{question.hint}</span>
              {question.kind === "text" && (
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    countWords(draft[field]) > question.maxWords && "font-medium text-destructive",
                  )}
                >
                  {countWords(draft[field])} / {question.maxWords} words
                </span>
              )}
            </div>
            {error && (
              <p id={`${field}-error`} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}

      {submitError && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting && <Loader2 aria-hidden className="animate-spin" />}
        {submitting ? "Submitting…" : "Submit answers"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Your draft is saved in this browser as you type. Submitting is final.
      </p>
    </form>
  );
}
