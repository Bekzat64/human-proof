import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAnonId } from "@/lib/anon";
import { createSimAttempt } from "@/lib/attempts";
import { getDb } from "@/lib/db";
import { attempts } from "@/lib/db/schema";
import { FREE_SIMULATIONS, hasActivePass } from "@/lib/pass";

// 303 See Other: after the POST the browser follows with a plain GET.
const seeOther = (path: string, request: Request) =>
  NextResponse.redirect(new URL(path, request.url), 303);

/**
 * Start a simulation. POST only: creating an attempt on GET would let link
 * prefetching and crawlers start attempts nobody asked for.
 *
 * The first simulation is free. After that a Job-Search Pass is needed, and
 * the visitor lands on the pricing page's paywall card rather than an error.
 */
export async function POST(request: Request) {
  const anonId = await getAnonId();
  // proxy.ts gives every request an identity, so this is only a safety net.
  if (!anonId) return seeOther("/", request);

  const [{ sims }] = await getDb()
    .select({ sims: count() })
    .from(attempts)
    .where(and(eq(attempts.anonId, anonId), eq(attempts.kind, "sim")));
  if (sims >= FREE_SIMULATIONS && !(await hasActivePass(anonId))) {
    return seeOther("/pricing?reason=sim_limit", request);
  }

  const attemptId = await createSimAttempt(anonId);
  return seeOther(`/sim/${attemptId}`, request);
}

/** Someone opened /sim/new directly: send them to the page with the start button. */
export function GET(request: Request) {
  return seeOther("/", request);
}
