"use client";

import { Flag } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { FLAG_NOTE_MAX_CHARS, FLAG_NOTE_MIN_CHARS } from "@/lib/sim-config";

type Props = {
  /** The note, if this message is already flagged. */
  flaggedNote?: string;
  disabled?: boolean;
  onFlag: (note: string) => void;
};

/** "Flag as wrong" on a copilot message: asks for a short reason, then records it. */
export function FlagPopover({ flaggedNote, disabled, onFlag }: Props) {
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const tooShort = note.trim().length < FLAG_NOTE_MIN_CHARS;

  if (flaggedNote !== undefined) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-destructive">
        <Flag aria-hidden className="mt-0.5 size-3.5 shrink-0 fill-current" />
        <span>
          <span className="font-medium">Flagged as wrong:</span> {flaggedNote}
        </span>
      </p>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (tooShort) return;
    onFlag(note.trim());
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs" disabled={disabled} className="text-muted-foreground">
          <Flag aria-hidden /> Flag as wrong
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Label htmlFor={noteId}>What is wrong with this message?</Label>
          <Textarea
            id={noteId}
            autoFocus
            rows={3}
            maxLength={FLAG_NOTE_MAX_CHARS}
            placeholder="e.g. Wrong denominator"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends the flag; Shift+Enter is a new line. Not while an IME is composing.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {tooShort ? `At least ${FLAG_NOTE_MIN_CHARS} characters` : "Enter to flag · Shift+Enter for a new line"}
            </span>
            <Button type="submit" size="sm" variant="destructive" disabled={tooShort}>
              Flag message
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
