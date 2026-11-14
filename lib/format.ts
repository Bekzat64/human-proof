// Locale-independent formatting. Generated text (e.g. trap claims) must be
// byte-identical on every machine, so no Intl / toLocaleString here.

/** 60934 → "60,934" */
export function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 8.4812 → "8.5" (no % sign) */
export function formatPct(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}

const POWERS_OF_TEN = [1, 10, 100, 1000] as const;

/** Round to 0–3 decimals, returning a number. */
export function roundTo(value: number, decimals: 0 | 1 | 2 | 3): number {
  const factor = POWERS_OF_TEN[decimals];
  return Math.round(value * factor) / factor;
}
