import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPct } from "@/lib/format";
import { buildVariant } from "@/lib/variant";
import { DatasetTable } from "./dataset-table";
import { TrapCard } from "./trap-card";

const isProduction = process.env.NODE_ENV === "production";

// In production this route must look like any other missing page, title included.
export function generateMetadata(): Metadata {
  return isProduction
    ? { title: "Page not found" }
    : { title: "Variant inspector (dev)", robots: { index: false, follow: false } };
}

const MAX_SEED = 2 ** 31 - 1; // attempts.seed is a Postgres integer

function parseSeed(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === "") return 1;
  const seed = Number(value);
  return Number.isInteger(seed) && seed >= 0 && seed <= MAX_SEED ? seed : null;
}

/**
 * DEV ONLY. Shows one variant in full — including the answer key and the
 * copilot's seeded errors — so the scenario can be eyeballed while building.
 * It must not exist in production: any production build (Vercel preview and
 * production alike) answers 404 before a variant is ever generated.
 */
export default async function VariantInspector({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string | string[] }>;
}) {
  if (isProduction) notFound();

  const seed = parseSeed((await searchParams).seed);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Variant inspector</h1>
          <Badge variant="destructive">Dev only — shows the answer key</Badge>
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <label htmlFor="seed" className="text-sm text-muted-foreground">
            Seed
          </label>
          <input
            id="seed"
            name="seed"
            type="number"
            min={0}
            max={MAX_SEED}
            defaultValue={seed ?? 1}
            className="h-8 w-36 rounded-lg border border-input bg-background px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button type="submit">Generate</Button>
          {seed !== null && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/dev/variant?seed=${Math.max(0, seed - 1)}`}>← Previous</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/dev/variant?seed=${Math.min(MAX_SEED, seed + 1)}`}>Next →</Link>
              </Button>
            </>
          )}
        </form>
      </header>

      {seed === null ? (
        <Card>
          <CardHeader>
            <CardTitle>That seed is not valid</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            A seed is a whole number from 0 to {MAX_SEED.toLocaleString("en-US")}.{" "}
            <Link href="/dev/variant?seed=1" className="underline underline-offset-4">
              Open seed 1
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <VariantView seed={seed} />
      )}
    </main>
  );
}

function VariantView({ seed }: { seed: number }) {
  const { publicData, groundTruth, traps } = buildVariant(seed);
  const { brief } = publicData;

  return (
    <>
      <section className="flex flex-col gap-4">
        <SectionHeading name="publicData" note="sent to the browser" />
        <Card>
          <CardHeader>
            <CardTitle>{publicData.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              From {brief.from}, {brief.role} at {brief.company} — “{brief.subject}”
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {brief.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <ol className="list-decimal pl-5">
              {brief.asks.map((ask) => (
                <li key={ask}>{ask}</li>
              ))}
            </ol>
            <ul className="list-disc pl-5 text-muted-foreground">
              {brief.dataNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <DatasetTable publicData={publicData} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading name="groundTruth" note="server-only" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Q1 · September churn" value={`${formatPct(groundTruth.sepChurnRate, 2)}%`} />
          <Fact label="Q2 · Driving channel" value={groundTruth.drivingChannel} />
          <Fact
            label="August → September"
            value={`${formatPct(groundTruth.augChurnRate, 2)}% → +${formatPct(groundTruth.churnIncreasePp, 2)}pp`}
          />
          <Fact label="Apr–Aug baseline" value={`${formatPct(groundTruth.baselineChurnRate, 2)}%`} />
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                {["Channel", "Aug churn", "Sep churn", "Change", "Aug cancellations", "Sep cancellations"].map(
                  (heading, i) => (
                    <th key={heading} className={`px-3 py-2 font-medium ${i === 0 ? "" : "text-right"}`}>
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {groundTruth.channels.map((c) => (
                <tr key={c.channel} className="border-t">
                  <td className="px-3 py-2">
                    {c.channel}{" "}
                    {c.channel === groundTruth.drivingChannel && <Badge>driver</Badge>}{" "}
                    {c.channel === traps.T3.trapValue && <Badge variant="outline">T3 decoy</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right">{formatPct(c.augChurnRate, 2)}%</td>
                  <td className="px-3 py-2 text-right">{formatPct(c.sepChurnRate, 2)}%</td>
                  <td className="px-3 py-2 text-right">+{formatPct(c.churnIncreasePp, 2)}pp</td>
                  <td className="px-3 py-2 text-right">{c.augCancellations.toLocaleString("en-US")}</td>
                  <td className="px-3 py-2 text-right">{c.sepCancellations.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading name="traps" note="server-only" />
        <div className="grid gap-4 lg:grid-cols-3">
          <TrapCard trap={traps.T1} unit="%" />
          <TrapCard trap={traps.T2} unit="%" />
          <TrapCard trap={traps.T3} unit="" />
        </div>
      </section>
    </>
  );
}

function SectionHeading({ name, note }: { name: string; note: string }) {
  return (
    <h2 className="flex items-baseline gap-2 text-lg font-semibold">
      <code className="font-mono">{name}</code>
      <span className="text-sm font-normal text-muted-foreground">{note}</span>
    </h2>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}
