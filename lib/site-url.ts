import "server-only";
import { headers } from "next/headers";

/**
 * The origin this request was served from, e.g. https://human-proof.example.
 * Proof URLs are built from it, so links are right on production, on preview
 * deployments and locally without any configuration. SITE_URL overrides it.
 */
export async function getBaseUrl(): Promise<string> {
  const fixed = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
