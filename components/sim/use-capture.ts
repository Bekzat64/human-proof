"use client";

import { useEffect, useState } from "react";
import { createEventLogger, type EventLogger } from "@/lib/capture/event-logger";

const FLUSH_EVERY_MS = 5000;

/**
 * Process capture for one attempt: batches events every 5s, sends the rest
 * with a beacon when the page goes away, and records every time the
 * candidate leaves the tab and how long they were gone.
 */
export function useCapture(attemptId: string): EventLogger {
  const [logger] = useState(() => createEventLogger(attemptId));

  useEffect(() => {
    const timer = window.setInterval(() => void logger.flush(), FLUSH_EVERY_MS);

    // A tab switch fires both `blur` and `visibilitychange`; count it once.
    let awaySince: number | null = null;
    const left = () => {
      if (awaySince !== null) return;
      awaySince = Date.now();
      logger.log({ type: "blur", payload: {} });
    };
    const returned = () => {
      if (awaySince === null) return;
      logger.log({ type: "focus", payload: { awayMs: Date.now() - awaySince } });
      awaySince = null;
    };
    const onVisibility = () => (document.hidden ? left() : returned());
    const onPageHide = () => logger.flushOnExit();

    window.addEventListener("blur", left);
    window.addEventListener("focus", returned);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("blur", left);
      window.removeEventListener("focus", returned);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      void logger.flush();
    };
  }, [logger]);

  return logger;
}
