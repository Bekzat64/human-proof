import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAnonId } from "@/lib/anon";
import { createSimAttempt } from "@/lib/attempts";
import { getDb } from "@/lib/db";
import { attempts } from "@/lib/db/schema";
import { FREE_SIMULATIONS, hasActivePass } from "@/lib/pass";
import { checkNewSim } from "@/lib/ratelimit";
import { startRedirect, tooManyRequests } from "@/lib/start-response";

/**
 * Start a simulation. POST only: creating an attempt on GET would let link
 * prefetching and crawlers start attempts nobody asked for.
 *
 * The first simulation is free. After that a Job-Search Pass is needed, and
 * the visitor lands on the pricing page's paywall card rather than an error.
 * At most 5 can be started per hour, pass or not.
 */
export async function POST(request: Request) {
  const anonId = await getAnonId();
  // proxy.ts gives every request an identity, so this is only a safety net.
  if (!anonId) return startRedirect(request, "/");

  const [{ sims }] = await getDb()
    .select({ sims: count() })
    .from(attempts)
    .where(and(eq(attempts.anonId, anonId), eq(attempts.kind, "sim")));
  if (sims >= FREE_SIMULATIONS && !(await hasActivePass(anonId))) {
    return startRedirect(request, "/pricing?reason=sim_limit");
  }

  const limit = await checkNewSim(anonId);
  if (!limit.ok) return tooManyRequests(request, limit.message);

  return startRedirect(request, `/sim/${await createSimAttempt(anonId)}`);
}

/** Someone opened /sim/new directly: send them to the page with the start button. */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/", request.url), 303);
}
