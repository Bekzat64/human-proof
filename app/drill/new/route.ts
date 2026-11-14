import { NextResponse } from "next/server";
import { getAnonId } from "@/lib/anon";
import { createDrillAttempt } from "@/lib/drill/attempts";
import { checkNewDrill } from "@/lib/ratelimit";
import { startRedirect, tooManyRequests } from "@/lib/start-response";

/** Start today's drill. POST only, so prefetching and crawlers cannot start the clock. At most 10 an hour. */
export async function POST(request: Request) {
  const anonId = await getAnonId();
  if (!anonId) return startRedirect(request, "/drill");

  const limit = await checkNewDrill(anonId);
  if (!limit.ok) return tooManyRequests(request, limit.message);

  return startRedirect(request, `/drill/${await createDrillAttempt(anonId)}`);
}

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/drill", request.url), 303);
}
