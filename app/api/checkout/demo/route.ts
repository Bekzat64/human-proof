import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { getAnonId } from "@/lib/anon";
import { activePass, grantPass } from "@/lib/pass";
import { isStripeEnabled } from "@/lib/stripe";

const seeOther = (path: string, request: Request) => NextResponse.redirect(new URL(path, request.url), 303);

/**
 * Demo checkout: only exists while no Stripe key is configured. Creates the
 * same `passes` row a paid Stripe session would, marked by its `demo_` id.
 * No payment of any kind happens here, and the page that posts here says so.
 */
export async function POST(request: Request) {
  if (isStripeEnabled()) return seeOther("/pricing", request);
  const anonId = await getAnonId();
  if (!anonId) return seeOther("/pricing", request);
  if (!(await activePass(anonId))) await grantPass(anonId, `demo_${nanoid(16)}`);
  return seeOther("/pricing?checkout=success", request);
}
