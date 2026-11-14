import "server-only";
import { PASS_DAYS, PASS_PRICE_USD_CENTS } from "./pass";

/**
 * Stripe Checkout, called over Stripe's REST API with fetch (two calls, so no
 * SDK dependency). Active only when STRIPE_SECRET_KEY is set; and only a test
 * key is accepted, because this is a hackathon build with no real payments.
 */

const API = "https://api.stripe.com/v1";

export function stripeKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    console.error("STRIPE_SECRET_KEY is not a test-mode key; Stripe checkout is disabled.");
    return null;
  }
  return key;
}

export const isStripeEnabled = () => stripeKey() !== null;

async function stripe<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(`Stripe ${path} failed: ${response.status} ${body.error?.message ?? ""}`);
  return body;
}

type Session = { id: string; url: string | null; payment_status: string; client_reference_id: string | null };

/** A Checkout session for one pass, tied to this visitor by client_reference_id. */
export async function createCheckoutSession(input: { anonId: string; baseUrl: string }): Promise<string> {
  const form = new URLSearchParams({
    mode: "payment",
    client_reference_id: input.anonId,
    success_url: `${input.baseUrl}/api/checkout/verify?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.baseUrl}/pricing?checkout=cancelled`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(PASS_PRICE_USD_CENTS),
    "line_items[0][price_data][product_data][name]": `HUMAN PROOF Job-Search Pass (${PASS_DAYS} days)`,
  });
  const session = await stripe<Session>("/checkout/sessions", { method: "POST", body: form });
  if (!session.url) throw new Error("Stripe returned a session without a URL");
  return session.url;
}

/** Read a session back from Stripe; the browser's word is never taken for a payment. */
export async function retrieveCheckoutSession(id: string): Promise<Session> {
  return stripe<Session>(`/checkout/sessions/${encodeURIComponent(id)}`);
}
