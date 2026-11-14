import type { Brief } from "@/lib/scenarios/types";

/** The manager's message that sets up the task. */
export function BriefPanel({ brief }: { brief: Brief }) {
  return (
    <section aria-labelledby="brief-heading" className="flex flex-col gap-3 text-sm">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Message from your manager
        </p>
        <h2 id="brief-heading" className="mt-1 text-base font-semibold">
          {brief.subject}
        </h2>
        <p className="text-muted-foreground">
          {brief.from}, {brief.role} · {brief.company}
        </p>
      </div>

      {brief.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      <ol className="list-decimal space-y-1 pl-5">
        {brief.asks.map((ask) => (
          <li key={ask}>{ask}</li>
        ))}
      </ol>

      <div className="rounded-lg bg-muted/60 p-3">
        <p className="mb-1 font-medium">About the data</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {brief.dataNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
