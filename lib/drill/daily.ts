import "server-only";
import { createRng } from "../rng";
import { DRILLS } from "../scenarios/drills";
import { DRILL_ITEMS_PER_DAY, type DrillItem, type PublicDrillItem } from "./types";

/** The drill's calendar runs on US Eastern time: one set per New York day, for everyone. */
export const DRILL_TIME_ZONE = "America/New_York";

/** The New York calendar date at `now`, as YYYY-MM-DD. */
export function drillDateKey(now: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DRILL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The calendar day before `dateKey`. Pure date arithmetic, no time zone involved. */
export function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** A stable 32-bit seed from a date key (FNV-1a). */
export function seedFromDate(dateKey: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < dateKey.length; i++) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export const scenarioIdForDate = (dateKey: string) => `drill-${dateKey}`;
export const dateFromScenarioId = (scenarioId: string) => scenarioId.replace(/^drill-/, "");

/** The five items of a given day: the same for every visitor, different from day to day. */
export function dailyDrill(dateKey: string): DrillItem[] {
  return createRng(seedFromDate(dateKey)).shuffle(DRILLS).slice(0, DRILL_ITEMS_PER_DAY);
}

/** Strip the answer key. This is the only form of an item that may reach the browser before submit. */
export function toPublicItem(item: DrillItem): PublicDrillItem {
  const { id, domain, context, table, sentences } = item;
  return { id, domain, context, table, sentences };
}
