"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ApiError } from "@/lib/api";
import type { ChatMessage } from "@/lib/attempts";
import type { EventLogger } from "@/lib/capture/event-logger";
import { MAX_MESSAGE_CHARS, MAX_USER_MESSAGES } from "@/lib/sim-config";
import { cn } from "@/lib/utils";
import { FlagPopover } from "./flag-popover";

const textOf = (message: UIMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

const toUiMessage = (message: ChatMessage): UIMessage => ({
  id: message.id,
  role: message.role,
  parts: [{ type: "text", text: message.text }],
  metadata: { source: message.source },
});

const isOffline = (message: UIMessage) =>
  (message.metadata as { source?: string } | undefined)?.source === "offline";

/** API routes answer errors as JSON; show their message rather than the raw body. */
function friendly(error: Error): string {
  try {
    const body = JSON.parse(error.message) as Partial<ApiError>;
    if (body.error?.message) return body.error.message;
  } catch {
    // not JSON: fall through
  }
  return "The copilot hit a problem. Try sending that again.";
}

type Props = {
  attemptId: string;
  initialMessages: ChatMessage[];
  initialFlags: Record<string, string>;
  logger: EventLogger;
};

/**
 * The AI copilot. Message ids come from the server (in the stream's first
 * chunk), so the id shown here is the id in the event log — which is what a
 * flag refers to.
 */
export function CopilotPanel({ attemptId, initialMessages, initialFlags, logger }: Props) {
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/copilot",
        // The server keeps the history; send only the new message.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { attemptId, text: textOf(messages[messages.length - 1]) },
        }),
      }),
  );
  const [initial] = useState(() => initialMessages.map(toUiMessage));
  const { messages, sendMessage, status, error, clearError } = useChat({
    id: attemptId,
    messages: initial,
    transport,
  });

  const [input, setInput] = useState("");
  const [flags, setFlags] = useState(initialFlags);

  const busy = status === "submitted" || status === "streaming";
  const used = messages.filter((m) => m.role === "user").length;
  const left = Math.max(0, MAX_USER_MESSAGES - used);
  const lastId = messages[messages.length - 1]?.id;

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function send(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy || left === 0) return;
    clearError();
    setInput("");
    void sendMessage({ text });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) send(event);
  }

  function flag(messageId: string, note: string) {
    setFlags((current) => ({ ...current, [messageId]: note }));
    logger.log({ type: "flag", payload: { messageId, note } }, { urgent: true });
  }

  return (
    <section aria-labelledby="copilot-heading" className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 py-3">
        <h2 id="copilot-heading" className="flex items-center gap-2 text-base font-semibold">
          <Sparkles aria-hidden className="size-4" /> AI copilot
        </h2>
        <p className="text-xs text-muted-foreground">
          Fast and confident, but not always right. Flag anything you believe is wrong.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message) => {
          const text = textOf(message);
          if (message.role === "user") {
            return (
              <p
                key={message.id}
                className="ml-8 self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground"
              >
                {text}
              </p>
            );
          }
          const streaming = busy && message.id === lastId;
          return (
            <div key={message.id} className="mr-8 flex flex-col items-start gap-1">
              <p className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
                {text || "…"}
              </p>
              {isOffline(message) && (
                <Badge variant="outline" title="Scripted replies from the data: no AI model answered this.">
                  Offline copilot
                </Badge>
              )}
              <FlagPopover
                flaggedNote={flags[message.id]}
                disabled={streaming}
                onFlag={(note) => flag(message.id, note)}
              />
            </div>
          );
        })}

        {status === "submitted" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Copilot is working…
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {friendly(error)}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex flex-col gap-2 border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Message the copilot"
            rows={2}
            maxLength={MAX_MESSAGE_CHARS}
            placeholder={left === 0 ? "Message limit reached" : "Ask about the data…"}
            value={input}
            disabled={left === 0}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={(e) =>
              logger.log({
                type: "paste",
                payload: { target: "copilot", chars: e.clipboardData.getData("text").length },
              })
            }
            className="min-h-0 resize-none"
          />
          <Button type="submit" size="icon-lg" disabled={busy || left === 0 || input.trim() === ""}>
            <SendHorizontal aria-hidden />
            <span className="sr-only">Send</span>
          </Button>
        </div>
        <p className={cn("text-xs text-muted-foreground", left === 0 && "text-destructive")}>
          {left === 0
            ? `You have used all ${MAX_USER_MESSAGES} copilot messages. You can still finish and submit.`
            : `${left} of ${MAX_USER_MESSAGES} messages left · Enter to send`}
        </p>
      </form>
    </section>
  );
}
