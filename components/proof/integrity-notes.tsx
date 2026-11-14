/** Observations about how the attempt was done. Neutral by design: they describe, they do not judge. */
export function IntegrityNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing out of the ordinary was observed during this attempt.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y rounded-xl border">
        {notes.map((note) => (
          <li key={note} className="flex gap-3 px-5 py-4 text-sm leading-relaxed">
            <span className="shrink-0 text-muted-foreground">Observed:</span>
            <span>{note}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground">
        These are observations from the session log, shown for context. None of them changes the score, and
        none is a finding of wrongdoing: there are ordinary explanations for each.
      </p>
    </div>
  );
}
