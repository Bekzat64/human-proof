import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ANON_COOKIE, ANON_COOKIE_MAX_AGE } from "@/lib/anon-cookie";

/**
 * Anonymous identity. Every visitor gets an `hp_anon` cookie on first contact;
 * all attempts, events and passes are keyed by it. No sign-up, no login.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(ANON_COOKIE)) {
    return NextResponse.next();
  }

  const anonId = nanoid();

  // Also put the cookie on the forwarded request, so the very first render
  // (and route handlers hit on the first request) can already read it.
  request.cookies.set(ANON_COOKIE, anonId);
  const response = NextResponse.next({ request: { headers: request.headers } });

  response.cookies.set(ANON_COOKIE, anonId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANON_COOKIE_MAX_AGE,
  });
  return response;
}

export const config = {
  // Pages and API routes only — skip build assets and files in /public.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
