import type { Level } from "../grading/types";

/** What goes on a profile or a résumé. Pure helpers: safe on server and client. */

export const CREDENTIAL_NAME = "AI-assisted Analysis";
export const ISSUER = "HUMAN PROOF";
/** A proof is valid for 12 months from the day it was issued. */
export const VALID_FOR_MONTHS = 12;

export function validUntil(issued: Date): Date {
  const date = new Date(issued);
  date.setUTCMonth(date.getUTCMonth() + VALID_FOR_MONTHS);
  return date;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export type StandingLabel = { n: number; percentile: number | null };

/** "Top 20%" only once there is a percentile; never invented for an early pilot. */
export function topShare(percentile: number): string {
  return `top ${Math.max(1, 100 - percentile)}%`;
}

/**
 * LinkedIn's add-to-profile link. It opens the "Add license or certification"
 * form with these fields filled in; the person still reviews and saves it.
 */
export function linkedInAddUrl(input: { level: Level; certUrl: string; certId: string; issued: Date }): string {
  const expires = validUntil(input.issued);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: `${ISSUER} — ${CREDENTIAL_NAME}: ${input.level}`,
    organizationName: ISSUER,
    issueYear: String(input.issued.getUTCFullYear()),
    issueMonth: String(input.issued.getUTCMonth() + 1),
    expirationYear: String(expires.getUTCFullYear()),
    expirationMonth: String(expires.getUTCMonth() + 1),
    certUrl: input.certUrl,
    certId: input.certId,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export function resumeLine(input: { level: Level; total: number; percentile: number | null; url: string }): string {
  const standing = input.percentile === null ? `${input.total}/100` : topShare(input.percentile);
  return `${ISSUER} — ${CREDENTIAL_NAME}: ${input.level} (${standing}), verify: ${input.url}`;
}
