import { Clipboard, EyeOff, Flag, Lock, MessageSquare, Send, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { formatClock, type TimelineItem, type TimelineKind } from "@/lib/proof/timeline";

const ICONS: Record<TimelineKind, LucideIcon> = {
  ai: Sparkles,
  prompt: MessageSquare,
  flag: Flag,
  paste: Clipboard,
  away: EyeOff,
  submit: Send,
};

/**
 * Process replay. `items` is exactly what this viewer may see: the page cuts
 * the list on the server, so the locked part is never sent to the browser.
 * `lockedCount` is how many further events exist behind the pass.
 */
export function ReplayTimeline({ items, lockedCount }: { items: TimelineItem[]; lockedCount: number }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        No process events were recorded for this attempt.
      </p>
    );
  }
  return (
    <div className="flex flex-col">
      <ol className="flex flex-col">
        {items.map((item, i) => (
          <Row key={i} item={item} last={i === items.length - 1 && lockedCount === 0} />
        ))}
      </ol>
      {lockedCount > 0 && <LockCard count={lockedCount} />}
    </div>
  );
}

function Row({ item, last }: { item: TimelineItem; last: boolean }) {
  const Icon = ICONS[item.kind];
  const seeded = item.kind === "ai" && item.trapId !== undefined;
  return (
    <li className="grid grid-cols-[3.25rem_1.75rem_1fr] gap-x-3">
      <time className="pt-1 font-mono text-xs text-muted-foreground tabular-nums">{formatClock(item.atSec)}</time>
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border",
            seeded ? "border-violet bg-violet/15 text-violet" : "text-muted-foreground",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
        </span>
        {!last && <span aria-hidden className="w-px flex-1 bg-border" />}
      </div>
      <div className={cn("flex flex-col gap-1.5 pb-7", seeded && "-mt-1 mb-6 rounded-lg border border-violet/40 bg-violet/[0.07] p-4 pb-4")}>
        <p className="flex flex-wrap items-center gap-2 pt-0.5 text-sm font-medium">
          {item.title}
          {item.tag && (
            <span className="rounded-full border px-2 py-0.5 text-[0.68rem] font-normal text-muted-foreground">
              {item.tag}
            </span>
          )}
        </p>
        {item.text && (
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{clip(item.text)}</p>
        )}
      </div>
    </li>
  );
}

const clip = (text: string, max = 420) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

/** The rest of the replay, behind the pass. The blurred rows are placeholders, not real events. */
function LockCard({ count }: { count: number }) {
  return (
    <div className="relative mt-2 overflow-hidden rounded-xl border">
      <div aria-hidden className="flex flex-col gap-5 p-6 opacity-60 blur-[6px] select-none">
        {[72, 54, 88, 40].map((width, i) => (
          <div key={i} className="grid grid-cols-[3.25rem_1.75rem_1fr] items-center gap-x-3">
            <span className="h-3 w-9 rounded bg-foreground/20" />
            <span className="size-7 rounded-full border" />
            <span className="h-3 rounded bg-foreground/20" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/55 p-6 text-center">
        <Lock aria-hidden className="size-4 text-violet" />
        <p className="font-medium">Full replay with Job-Search Pass</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {count} more {count === 1 ? "event" : "events"} from this attempt: every prompt, reply, flag and pause.
        </p>
        <Button asChild size="sm">
          <Link href="/pricing">See the pass</Link>
        </Button>
      </div>
    </div>
  );
}
