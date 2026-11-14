import "server-only";

/**
 * Does this visitor hold an active Job-Search Pass?
 *
 * Stub: always false until Stage 6 wires Stripe Checkout and the `passes`
 * table. Everything that depends on a pass (the full process replay) already
 * calls this, so Stage 6 only has to fill it in.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function hasActivePass(anonId: string | null): Promise<boolean> {
  return false;
}
