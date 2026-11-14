"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/attempts";
import type { PublicData } from "@/lib/scenarios/types";
import { cn } from "@/lib/utils";
import { BriefPanel } from "./brief-panel";
import { CopilotPanel } from "./copilot-panel";
import { Countdown, TimeUpBanner, useCountdown } from "./countdown";
import { DataTable } from "./data-table";
import { useCapture } from "./use-capture";

// Client-only: the form reads its saved draft from localStorage on first render.
const AnswerForm = dynamic(() => import("./answer-form"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading your answers…</p>,
});

const PANELS = [
  { id: "brief", label: "Brief & answers" },
  { id: "data", label: "Data" },
  { id: "copilot", label: "Copilot" },
] as const;
type PanelId = (typeof PANELS)[number]["id"];

type Props = {
  attemptId: string;
  /** The only scenario data the browser ever receives. */
  publicData: PublicData;
  initialMessages: ChatMessage[];
  initialFlags: Record<string, string>;
  /** Time left when the page was rendered, by the server's clock. */
  remainingAtLoadMs: number;
};

/**
 * The simulation screen. Desktop: brief + answers | data | copilot, side by
 * side. Below `lg` the same three panels sit behind tabs (they stay mounted,
 * so switching tabs never loses chat or form state).
 */
export function SimWorkspace({
  attemptId,
  publicData,
  initialMessages,
  initialFlags,
  remainingAtLoadMs,
}: Props) {
  const logger = useCapture(attemptId);
  const remainingMs = useCountdown(remainingAtLoadMs);
  const [panel, setPanel] = useState<PanelId>("brief");
  const hiddenOnMobile = (id: PanelId) => panel !== id && "max-lg:hidden";

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="text-sm font-semibold tracking-[0.2em]">HUMAN PROOF</span>
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">
            {publicData.title}
          </span>
        </div>
        <Countdown remainingMs={remainingMs} />
      </header>

      {remainingMs <= 0 && <TimeUpBanner />}

      <nav aria-label="Panels" className="flex gap-1.5 border-b p-2 lg:hidden">
        {PANELS.map(({ id, label }) => (
          <Button
            key={id}
            size="sm"
            variant={panel === id ? "default" : "ghost"}
            aria-pressed={panel === id}
            onClick={() => setPanel(id)}
            className="flex-1"
          >
            {label}
          </Button>
        ))}
      </nav>

      <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(19rem,23rem)_minmax(0,1fr)_minmax(19rem,23rem)] lg:divide-x">
        <div className={cn("flex min-h-0 flex-col gap-8 overflow-y-auto p-4", hiddenOnMobile("brief"))}>
          <BriefPanel brief={publicData.brief} />
          <AnswerForm
            attemptId={attemptId}
            questions={publicData.questions}
            channels={publicData.channels}
            logger={logger}
          />
        </div>

        <div className={cn("min-h-0 overflow-y-auto p-4", hiddenOnMobile("data"))}>
          <DataTable publicData={publicData} logger={logger} />
        </div>

        <div className={cn("flex min-h-0 flex-col", hiddenOnMobile("copilot"))}>
          <CopilotPanel
            attemptId={attemptId}
            initialMessages={initialMessages}
            initialFlags={initialFlags}
            logger={logger}
          />
        </div>
      </main>
    </div>
  );
}
