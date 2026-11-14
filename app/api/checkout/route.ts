import { NextResponse } from "next/server";
import { getAnonId } from "@/lib/anon";
import { activePass } from "@/lib/pass";
import { getBaseUrl } from "@/lib/site-url";
import { createCheckoutSession, isStripeEnabled } from "@/lib/stripe";

const seeOther = (path: string, request: Request) => NextResponse.redirect(new URL(path, request.url), 303);

/**
 * "Get the pass" button (form POST). With a Stripe test key: off to Stripe
 * Checkout. Without one: the clearly labelled demo checkout. Either way the
 * same `passes` row is created at the end.
 */
export async function POST(request: Request) {
  const anonId = await getAnonId();
  if (!anonId) return seeOther("/pricing", request);
  if (await activePass(anonId)) return seeOther("/pricing?checkout=already_active", request);

  if (!isStripeEnabled()) return seeOther("/checkout/demo", request);
  try {
    const url = await createCheckoutSession({ anonId, baseUrl: await getBaseUrl() });
    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error("stripe checkout failed", error);
    return seeOther("/pricing?checkout=error", request);
  }
}

export function GET(request: Request) {
  return seeOther("/pricing", request);
}
