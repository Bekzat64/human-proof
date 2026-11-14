import { NextResponse } from "next/server";
import { getAnonId } from "@/lib/anon";
import { createDrillAttempt } from "@/lib/drill/attempts";

// 303 See Other: after the POST the browser follows with a plain GET.
const seeOther = (path: string, request: Request) => NextResponse.redirect(new URL(path, request.url), 303);

/** Start today's drill. POST only, so prefetching and crawlers cannot start the clock. */
export async function POST(request: Request) {
  const anonId = await getAnonId();
  if (!anonId) return seeOther("/drill", request);
  return seeOther(`/drill/${await createDrillAttempt(anonId)}`, request);
}

export function GET(request: Request) {
  return seeOther("/drill", request);
}
