import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Trap } from "@/lib/scenarios/types";

const KIND_LABEL: Record<Trap["kind"], string> = {
  wrong_denominator: "Wrong denominator",
  fabricated_benchmark: "Fabricated benchmark",
  wrong_channel: "Wrong channel",
};

/** One seeded copilot error: what it will claim, and why that is wrong. */
export function TrapCard({ trap, unit }: { trap: Trap; unit: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant="destructive">{trap.id}</Badge>
          {KIND_LABEL[trap.kind]}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <blockquote className="border-l-2 border-destructive/50 pl-3">{trap.wrongClaim}</blockquote>
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-muted-foreground">Trap value</dt>
            <dd className="font-semibold tabular-nums">
              {trap.trapValue}
              {unit}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Correct value</dt>
            <dd className="font-semibold tabular-nums">
              {trap.correctValue}
              {unit}
            </dd>
          </div>
        </dl>
        <p className="text-muted-foreground">{trap.explanation}</p>
      </CardContent>
    </Card>
  );
}
