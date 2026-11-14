"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessageFrom } from "@/lib/api";
import { CHECKIN_LABELS, CHECKIN_QUESTIONS, type CheckinQuestion } from "@/lib/checkin";

/** Two yes/no questions about what happened after the first proof. */
export function Checkin({
  attemptId,
  answered,
}: {
  attemptId: string;
  answered: Partial<Record<CheckinQuestion, boolean>>;
}) {
  const [answers, setAnswers] = useState(answered);
  const [pending, setPending] = useState<CheckinQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(question: CheckinQuestion, answer: boolean) {
    setPending(question);
    setError(null);
    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, question, answer }),
      });
      if (response.ok || response.status === 409) setAnswers((all) => ({ ...all, [question]: answer }));
      else setError(await errorMessageFrom(response, "Your answer could not be saved. Try again."));
    } catch {
      setError("Your answer could not be sent. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {CHECKIN_QUESTIONS.map((question) => (
        <div key={question} className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 first:border-t-0 first:pt-0">
          <span className="text-sm">{CHECKIN_LABELS[question]}</span>
          {answers[question] !== undefined ? (
            <span role="status" className="flex items-center gap-1.5 text-sm text-violet">
              <Check aria-hidden className="size-4" /> {answers[question] ? "Yes" : "Not yet"} — saved
            </span>
          ) : (
            <span className="flex gap-2">
              <Button size="sm" disabled={pending !== null} onClick={() => send(question, true)}>
                Yes
              </Button>
              <Button size="sm" variant="outline" disabled={pending !== null} onClick={() => send(question, false)}>
                Not yet
              </Button>
            </span>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
