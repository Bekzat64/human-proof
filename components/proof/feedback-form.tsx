"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessageFrom } from "@/lib/api";
import { FEEDBACK_NOTE_MAX_CHARS, VERDICT_LABELS, type EmployerVerdict } from "@/lib/feedback-schema";

/** "Would interview" / "Not yet" plus an optional note. One answer per visitor per proof. */
export function FeedbackForm({
  attemptId,
  existing,
  isOwner,
}: {
  attemptId: string;
  existing: EmployerVerdict | null;
  isOwner: boolean;
}) {
  const [recorded, setRecorded] = useState<EmployerVerdict | null>(existing);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<EmployerVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isOwner) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Employers who open this link see two buttons here, “Would interview” and “Not yet”, with an optional
        note. You cannot answer for your own proof.
      </p>
    );
  }

  if (recorded) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-xl border bg-card p-6 text-sm">
        <Check aria-hidden className="size-4 text-violet" />
        Your answer is recorded: <span className="font-medium">{VERDICT_LABELS[recorded]}</span>. Thank you.
      </p>
    );
  }

  async function send(verdict: EmployerVerdict) {
    setPending(verdict);
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, verdict, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      if (response.ok || response.status === 409) return setRecorded(verdict);
      setError(await errorMessageFrom(response, "Your answer could not be saved. Try again."));
    } catch {
      setError("Your answer could not be sent. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="feedback-note">Note (optional)</Label>
        <Textarea
          id="feedback-note"
          value={note}
          maxLength={FEEDBACK_NOTE_MAX_CHARS}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What would you want to see more of?"
          rows={3}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button size="lg" disabled={pending !== null} onClick={() => send("would_interview")}>
          {pending === "would_interview" ? "Saving…" : VERDICT_LABELS.would_interview}
        </Button>
        <Button size="lg" variant="outline" disabled={pending !== null} onClick={() => send("not_yet")}>
          {pending === "not_yet" ? "Saving…" : VERDICT_LABELS.not_yet}
        </Button>
        <span className="text-xs text-muted-foreground">No account needed. One answer per proof.</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
