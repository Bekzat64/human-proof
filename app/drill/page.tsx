import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ProofShell } from "@/components/proof/proof-shell";
import { Button } from "@/components/ui/button";
import { getAnonId } from "@/lib/anon";
import { getDb } from "@/lib/db";
import { attempts } from "@/lib/db/schema";
import { completedDrillDates, currentStreak } from "@/lib/drill/attempts";
import { drillDateKey, scenarioIdForDate } from "@/lib/drill/daily";
import { DRILL_ITEMS_PER_DAY } from "@/lib/drill/types";

export const metadata: Metadata = {
  title: "Daily drill",
  description: "Five short AI answers a day. Find the sentence that is wrong. Three minutes, no sign-up.",
};

const longDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/** Today's drill: start it, resume it, or see that it is done. */
export default async function DrillPage() {
  const anonId = await getAnonId();
  const today = drillDateKey(new Date());

  const [todays, doneDates, streak] = anonId
    ? await Promise.all([
        getDb()
          .select({ id: attempts.id, status: attempts.status, total: attempts.total })
          .from(attempts)
          .where(and(eq(attempts.anonId, anonId), eq(attempts.kind, "drill"), eq(attempts.scenarioId, scenarioIdForDate(today))))
          .orderBy(desc(attempts.startedAt)),
        completedDrillDates(anonId),
        currentStreak(anonId),
      ])
    : [[], [], 0];

  const inProgress = todays.find((a) => a.status === "active");
  const completedToday = doneDates.includes(today);
  const lastDone = todays.find((a) => a.status === "graded");

  return (
    <ProofShell>
      <section className="flex flex-col items-start gap-6">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Daily drill · {longDate(today)}
        </p>
        <h1 className="font-display text-5xl leading-tight text-balance sm:text-6xl">Spot the AI error</h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          {DRILL_ITEMS_PER_DAY} short AI answers to an analyst&apos;s question, each with its data table. In each one,
          click the sentence that is wrong and say why, or call it clean. Three minutes. Everyone gets the same set
          today; a new one starts at midnight New York time.
        </p>

        {streak > 0 && (
          <p className="text-sm">
            <span aria-hidden>🔥</span> {streak}-day streak
            {!completedToday && <span className="text-muted-foreground"> · do today&apos;s drill to keep it going</span>}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {inProgress ? (
            <Button asChild size="lg">
              <Link href={`/drill/${inProgress.id}`}>Resume today&apos;s drill</Link>
            </Button>
          ) : (
            <form action="/drill/new" method="post">
              <Button type="submit" size="lg" variant={completedToday ? "outline" : "default"}>
                {completedToday ? "Take it again (won't count)" : "Start today's drill"}
              </Button>
            </form>
          )}
          {lastDone && (
            <Button asChild size="lg" variant={completedToday ? "default" : "outline"}>
              <Link href={`/drill/${lastDone.id}`}>See today&apos;s result</Link>
            </Button>
          )}
        </div>
        {completedToday && (
          <p className="text-sm text-muted-foreground">
            Today&apos;s drill is done. You can take it again for practice; only the first one counts toward your
            streak.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        <h2 className="font-medium">Want the full picture?</h2>
        <p className="text-sm text-muted-foreground">
          The 15-minute simulation is a real analyst brief with a copilot that makes mistakes on its own. It ends in
          a shareable proof.
        </p>
        <form action="/sim/new" method="post">
          <Button type="submit" variant="outline" size="lg">
            Start the 15-minute simulation
          </Button>
        </form>
      </section>
    </ProofShell>
  );
}
