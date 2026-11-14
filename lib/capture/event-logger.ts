import type { ClientEvent, ClientEventInput } from "../events/schema";
import { MAX_EVENTS_PER_BATCH } from "../sim-config";

const ENDPOINT = "/api/events";
/** If the network is down, keep at most this many events waiting. */
const MAX_QUEUED = 500;

export type EventLogger = {
  /** Queue an event. `urgent` sends it straight away (used for flags). */
  log(event: ClientEventInput, options?: { urgent?: boolean }): void;
  /** Send everything queued and wait for it. */
  flush(): Promise<void>;
  /** Last-chance send while the page is being hidden or closed. */
  flushOnExit(): void;
};

/**
 * Process capture, browser side: events are queued and sent in batches (the
 * caller flushes every 5s), with `sendBeacon` as the page goes away so the
 * tail of a session is not lost.
 */
export function createEventLogger(attemptId: string): EventLogger {
  let queue: ClientEvent[] = [];
  let sending: Promise<void> | null = null;

  const body = (batch: ClientEvent[]) => JSON.stringify({ attemptId, events: batch });

  async function drain(): Promise<void> {
    while (queue.length > 0) {
      const batch = queue.slice(0, MAX_EVENTS_PER_BATCH);
      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body(batch),
          keepalive: true,
        });
        // 5xx: keep the batch and try again on the next flush.
        if (response.status >= 500) return;
      } catch {
        return; // offline: same, retry later
      }
      // Sent, or rejected for good (4xx) — either way, do not resend.
      queue = queue.slice(batch.length);
    }
  }

  function flush(): Promise<void> {
    sending ??= drain().finally(() => {
      sending = null;
    });
    return sending;
  }

  return {
    log(event, options) {
      queue.push({ ...event, at: Date.now() } as ClientEvent);
      if (queue.length > MAX_QUEUED) queue = queue.slice(-MAX_QUEUED);
      if (options?.urgent) void flush();
    },
    flush,
    flushOnExit() {
      while (queue.length > 0) {
        const batch = queue.slice(0, MAX_EVENTS_PER_BATCH);
        const queued = navigator.sendBeacon(ENDPOINT, new Blob([body(batch)], { type: "application/json" }));
        if (!queued) return;
        queue = queue.slice(batch.length);
      }
    },
  };
}
