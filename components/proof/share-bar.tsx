"use client";

import { Check, ExternalLink, ImageDown, Link2, ScrollText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Status = { kind: "idle" } | { kind: "done"; what: string } | { kind: "error"; message: string };

/** Owner-only: the ways to put this proof in front of someone. */
export function ShareBar({
  proofUrl,
  linkedInUrl,
  resumeLine,
  imageUrl,
  fileName,
}: {
  proofUrl: string;
  /** Omitted for a drill proof, which is not a credential. */
  linkedInUrl?: string;
  resumeLine?: string;
  imageUrl: string;
  fileName: string;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ kind: "done", what });
    } catch {
      setStatus({ kind: "error", message: `Copying is blocked in this browser. Select and copy it by hand: ${text}` });
    }
  }

  async function shareImage() {
    setBusy(true);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`image request failed: ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type || "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My HUMAN PROOF", url: proofUrl });
        setStatus({ kind: "done", what: "Image shared" });
      } else {
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(href);
        setStatus({ kind: "done", what: "Image downloaded" });
      }
    } catch (error) {
      // Closing the share sheet is not a failure.
      if ((error as { name?: string }).name !== "AbortError") {
        setStatus({ kind: "error", message: "The image could not be created. Try again in a moment." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Share this proof" className="flex flex-col gap-4 rounded-xl border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">This proof is yours. Share it.</h2>
        <p className="text-sm text-muted-foreground">
          Only you see this bar. Anyone with the link sees the same page without it.
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button size="lg" onClick={() => copy(proofUrl, "Link copied")}>
          <Link2 aria-hidden /> Copy link
        </Button>
        {linkedInUrl && (
          <Button size="lg" variant="outline" asChild>
            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden /> Add to LinkedIn
            </a>
          </Button>
        )}
        {resumeLine && (
          <Button size="lg" variant="outline" onClick={() => copy(resumeLine, "Resume line copied")}>
            <ScrollText aria-hidden /> Copy resume line
          </Button>
        )}
        <Button size="lg" variant="outline" disabled={busy} onClick={shareImage}>
          <ImageDown aria-hidden /> {busy ? "Preparing image…" : "Download / share image"}
        </Button>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm">
        {status.kind === "done" && (
          <span className="flex items-center gap-1.5 text-violet">
            <Check aria-hidden className="size-4" /> {status.what}
          </span>
        )}
        {status.kind === "error" && <span className="text-destructive">{status.message}</span>}
        {status.kind === "idle" && resumeLine && (
          <span className="font-mono text-xs break-all text-muted-foreground">{resumeLine}</span>
        )}
      </p>
    </section>
  );
}
