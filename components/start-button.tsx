"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessageFrom } from "@/lib/api";

type Props = {
  /** What to start. Both are POST-only, so prefetching and crawlers never start a clock. */
  kind: "sim" | "drill";
  children: React.ReactNode;
  size?: "default" | "lg" | "sm";
  variant?: "default" | "outline" | "ghost";
  className?: string;
};

/**
 * Starts a simulation or a drill. A real form (works without JavaScript); with
 * JavaScript it posts via fetch so a rate-limit message can be shown in place
 * instead of a separate page.
 */
export function StartButton({ kind, children, size = "lg", variant = "default", className }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = kind === "sim" ? "/sim/new" : "/drill/new";

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(action, { method: "POST", headers: { Accept: "application/json" } });
      if (!response.ok) {
        setError(await errorMessageFrom(response, "That did not start. Try again in a moment."));
        setPending(false);
        return;
      }
      const { redirectTo } = (await response.json()) as { redirectTo: string };
      router.push(redirectTo);
      // Keep the spinner until the next page takes over.
    } catch {
      setError("That did not start. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form action={action} method="post" onSubmit={start} className={className}>
      <Button type="submit" size={size} variant={variant} disabled={pending} className="w-full sm:w-auto">
        {pending && <Loader2 aria-hidden className="animate-spin" />}
        {children}
      </Button>
      {error && (
        <p role="alert" className="max-w-sm pt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
