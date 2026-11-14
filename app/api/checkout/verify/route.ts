import { NextResponse } from "next/server";
import { z } from "zod";
import { getAnonId } from "@/lib/anon";
import { grantPass } from "@/lib/pass";
import { isStripeEnabled, retrieveCheckoutSession } from "@/lib/stripe";

const seeOther = (path: string, request: Request) => NextResponse.redirect(new URL(path, request.url), 303);

const querySchema = z.object({ session_id: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/) });

/**
 * Stripe's return URL. The session is fetched from Stripe and must be paid
 * and belong to this visitor before a pass is created; the pass is keyed on
 * the session id, so reloading this URL does not create a second one.
 */
export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success || !isStripeEnabled()) return seeOther("/pricing?checkout=error", request);

  const anonId = await getAnonId();
  try {
    const session = await retrieveCheckoutSession(parsed.data.session_id);
    if (session.payment_status !== "paid" || !anonId || session.client_reference_id !== anonId) {
      return seeOther("/pricing?checkout=unpaid", request);
    }
    await grantPass(anonId, session.id);
    return seeOther("/pricing?checkout=success", request);
  } catch (error) {
    console.error("stripe verify failed", error);
    return seeOther("/pricing?checkout=error", request);
  }
}
