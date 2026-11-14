import type { DatasetRow } from "./types";

export function sum<T>(items: readonly T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

/** Churn in %: cancellations ÷ subscribers at the start of the month. */
export function churnPct(rows: readonly DatasetRow[]): number {
  return (sum(rows, (r) => r.cancellations) / sum(rows, (r) => r.subs_start)) * 100;
}
