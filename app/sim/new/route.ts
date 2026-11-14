import { NextResponse } from "next/server";
import { getAnonId } from "@/lib/anon";
import { createSimAttempt } from "@/lib/attempts";

// 303 See Other: after the POST the browser follows with a plain GET.
const seeOther = (path: string, request: Request) =>
  NextResponse.redirect(new URL(path, request.url), 303);

/**
 * Start a simulation. POST only: creating an attempt on GET would let link
 * prefetching and crawlers start attempts nobody asked for.
 */
export async function POST(request: Request) {
  const anonId = await getAnonId();
  // proxy.ts gives every request an identity, so this is only a safety net.
  if (!anonId) return seeOther("/", request);

  const attemptId = await createSimAttempt(anonId);
  return seeOther(`/sim/${attemptId}`, request);
}

/** Someone opened /sim/new directly: send them to the page with the start button. */
export function GET(request: Request) {
  return seeOther("/", request);
}
