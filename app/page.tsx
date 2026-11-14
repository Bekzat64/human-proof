import { FileCheck2, Flag, Table2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Step = { icon: LucideIcon; title: string; body: string };

const STEPS: Step[] = [
  {
    icon: Table2,
    title: "Work a real brief",
    body: "Your manager needs an answer by tomorrow. You get the data, 15 minutes and an AI copilot.",
  },
  {
    icon: Flag,
    title: "Catch the copilot's mistakes",
    body: "The copilot is confident, fast and sometimes subtly wrong. Spotting where is the test.",
  },
  {
    icon: FileCheck2,
    title: "Share the evidence",
    body: "A public Proof page shows what you verified and what you caught — not just a badge.",
  },
];

// Interim landing. The full landing ships with Stage 7.
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-sm font-semibold tracking-[0.2em]">HUMAN PROOF</span>
        <Badge variant="outline">Preview build</Badge>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-12 py-12">
        <section className="flex max-w-3xl flex-col gap-6">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            AI can do the task. HUMAN PROOF shows you can direct it.
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
            A 15-minute analyst work simulation with an AI copilot that is deliberately seeded with
            subtle errors. Catch them, make the call, and get proof you can send to a hiring
            manager.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {/* POST, not a link: starting an attempt must be a deliberate action. */}
            <form action="/sim/new" method="post">
              <Button type="submit" size="lg">
                Start the 15-minute simulation
              </Button>
            </form>
            <span className="text-sm text-muted-foreground">No sign-up. No login.</span>
          </div>
        </section>

        <section aria-label="How it works" className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardHeader>
                <Icon aria-hidden className="size-5 text-muted-foreground" />
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="py-6 text-sm text-muted-foreground">
        Early build: the simulation works end to end; grading and the public Proof page are next.
      </footer>
    </div>
  );
}
