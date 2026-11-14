import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "./db";
import { passes } from "./db/schema";

/** Job-Search Pass: $19 for 7 days. */
export const PASS_PRICE_USD_CENTS = 1900;
export const PASS_DAYS = 7;
/** Free tier: this many simulations per browser; the next one needs a pass. */
export const FREE_SIMULATIONS = 1;

/** The visitor's pass that is still running, if any (the one that lasts longest). */
export async function activePass(anonId: string | null): Promise<{ expiresAt: Date } | null> {
  if (!anonId) return null;
  const [row] = await getDb()
    .select({ expiresAt: passes.expiresAt })
    .from(passes)
    .where(and(eq(passes.anonId, anonId), eq(passes.status, "active"), gt(passes.expiresAt, new Date())))
    .orderBy(desc(passes.expiresAt))
    .limit(1);
  return row ?? null;
}

export async function hasActivePass(anonId: string | null): Promise<boolean> {
  return (await activePass(anonId)) !== null;
}

/**
 * Record a pass. `checkoutId` is the Stripe Checkout session id, or a
 * `demo_…` id from the demo checkout; it is unique, so verifying the same
 * session twice (a reload of the return URL) creates one pass, not two.
 */
export async function grantPass(anonId: string, checkoutId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + PASS_DAYS * 24 * 60 * 60 * 1000);
  await getDb()
    .insert(passes)
    .values({ anonId, stripeSessionId: checkoutId, status: "active", expiresAt })
    .onConflictDoNothing({ target: passes.stripeSessionId });
}
