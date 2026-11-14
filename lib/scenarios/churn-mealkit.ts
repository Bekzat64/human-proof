import "server-only";
import { formatCount, formatPct } from "../format";
import { CHANNELS } from "./types";
import type { AnswerQuestion, Brief, Channel, ChannelFacts, DatasetColumn } from "./types";

/**
 * Scenario 1 — "Churn spike at a US meal-kit subscription".
 *
 * Static content, the knobs the variant generator turns, and the wording of
 * the three seeded copilot errors. Server-only: the trap wording is the answer
 * key. lib/variant.ts turns this plus a seed into a concrete variant.
 */

type Range = readonly [min: number, max: number];

const brief: Brief = {
  from: "Dana",
  role: "Director of Growth Analytics",
  company: "Sprig & Skillet",
  subject: "September churn — I need your read before tomorrow",
  paragraphs: [
    "September churn jumped, and leadership meets tomorrow morning. I need your read on it today.",
    "Attached is the monthly subscriber table by acquisition channel, April through September. You have the AI copilot — use it, but you own the answer.",
  ],
  // Stating the definition keeps Q1 fair (one right answer) without giving T1
  // away: the candidate still has to notice which denominator the copilot used.
  dataNotes: [
    "Monthly churn rate = cancellations during the month ÷ subscribers at the start of the month.",
    "Subs (end) = subs (start) + new subs − cancellations. Revenue is in US dollars.",
    "Channel = the acquisition channel a subscriber originally signed up through.",
  ],
  asks: [
    "What was our September monthly churn rate?",
    "Which acquisition channel drove the increase?",
    "What should we do about it?",
    "What did you verify, and what did you not trust?",
  ],
};

const questions: AnswerQuestion[] = [
  {
    id: "q1",
    kind: "percent",
    label: "September monthly churn rate",
    hint: "All channels combined, in percent.",
  },
  {
    id: "q2",
    kind: "channel",
    label: "Channel that drove the increase",
    hint: "Pick one acquisition channel.",
  },
  {
    id: "q3",
    kind: "text",
    label: "Your recommendation",
    hint: "What should the company do, and why?",
    maxWords: 120,
  },
  {
    id: "q4",
    kind: "text",
    label: "What did you verify, and what did you not trust?",
    hint: "Name the checks you ran and anything you rejected.",
    maxWords: 60,
  },
];

const columns: DatasetColumn[] = [
  { key: "month", label: "Month", kind: "month" },
  { key: "channel", label: "Channel", kind: "text" },
  { key: "subs_start", label: "Subs (start)", kind: "count" },
  { key: "new_subs", label: "New subs", kind: "count" },
  { key: "cancellations", label: "Cancellations", kind: "count" },
  { key: "subs_end", label: "Subs (end)", kind: "count" },
  { key: "revenue", label: "Revenue", kind: "usd" },
];

const months = [
  { key: "2026-04", label: "Apr 2026" },
  { key: "2026-05", label: "May 2026" },
  { key: "2026-06", label: "Jun 2026" },
  { key: "2026-07", label: "Jul 2026" },
  { key: "2026-08", label: "Aug 2026" },
  { key: "2026-09", label: "Sep 2026" },
] as const;

/**
 * What a seed varies. Each variant casts the four channels into roles:
 * one LARGEST channel (most subscribers, so most cancellations in absolute
 * terms), one SPIKING channel (smaller, but its churn rate jumps in September)
 * and two others. Which channel plays which role is random, so the answer
 * cannot be memorised or shared between candidates.
 */
const generation = {
  /** Total subscribers at the start of April. */
  startingSubscribers: [38_000, 90_000],
  /** Share of April subscribers. The two other channels split what is left. */
  share: {
    largest: [0.4, 0.5],
    spiking: [0.21, 0.31],
    firstOtherShareOfRest: [0.4, 0.6],
  },
  /** April–August monthly churn level, in %. */
  baseChurnPct: {
    largest: [7.4, 9.2],
    spiking: [4.4, 5.6],
    other: [4.8, 6.6],
  },
  /** Month-to-month wobble around the base level, in percentage points. */
  churnNoisePp: 0.3,
  /** New subscribers as % of start-of-month subscribers, April–August. */
  grossAddsPct: [11.5, 14.5],
  grossAddsNoisePp: 0.8,
  /**
   * September is the seasonal sign-up peak for meal kits (back to routine), so
   * every channel adds this many extra points of new subscribers. The base
   * therefore grows during September — which is exactly why dividing by
   * end-of-month subscribers (trap T1) understates churn.
   */
  sepGrossAddsBoostPp: [5.5, 8.0],
  /** September vs August churn change, in percentage points. */
  sepChangePp: {
    spiking: [5.0, 7.2],
    everyoneElse: [0.1, 1.3],
  },
  /** Monthly revenue per subscriber, USD. Colour only: no question depends on it. */
  revenuePerSubscriber: [118, 162],
  revenueNoise: 0.03,
} satisfies Record<string, Range | number | Record<string, Range>>;

/**
 * What every variant must satisfy. The generator redraws until all hold, and
 * lib/variant.test.ts re-derives each one from the raw dataset for 1,000 seeds.
 */
const invariants = {
  /** Realism: every channel-month and every monthly total stays in this band. */
  churnPct: [4, 12],
  /** The story: total churn rises this much from August to September. */
  sepIncreasePp: [1.5, 4],
  /** April–August totals stay within this spread, so September reads as a jump. */
  maxBaselineSpreadPp: 1.0,
  /** T2: September must sit this far above the company's own Apr–Aug baseline. */
  minSepAboveBaselinePp: 1.5,
  /**
   * T1: the subs_end figure must be this far from the truth. Grading accepts
   * ±0.3pp, so a 0.6pp gap means repeating the trap can never score as correct
   * (and the 1-decimal figure shown in the claim is still ≥0.5pp off).
   */
  minT1GapPp: 0.6,
  /** T3: the true driver's rate increase beats the runner-up by this much. */
  minDriverLeadPp: 2,
  /** T3: the trap channel's September cancellations beat the runner-up by this factor. */
  minCancellationsLead: 1.05,
  /** T3: the true driver also accounts for at least this share of the extra cancellations. */
  minDriverShareOfExtraCancellations: 0.5,
} as const;

/** Inputs for the trap wording: all derived from the dataset by lib/variant.ts. */
export type TrapFacts = {
  sepChurnPct: number;
  /** September cancellations ÷ September subs_end, in %. */
  sepChurnBySubsEndPct: number;
  baselineChurnPct: number;
  sepTotals: { subsStart: number; cancellations: number; subsEnd: number };
  /** The channel with the largest churn-rate increase (the right answer to Q2). */
  driver: ChannelFacts;
  /** The channel with the most September cancellations (the T3 decoy). */
  decoy: ChannelFacts;
};

/** T2's invented benchmark: the next whole percent comfortably above September. */
function fabricatedBenchmarkPct(sepChurnPct: number): number {
  return Math.ceil(sepChurnPct + 0.5);
}

const traps = {
  fabricatedBenchmarkPct,

  T1: {
    wrongClaim: (f: TrapFacts) =>
      `September churn was ${formatPct(f.sepChurnBySubsEndPct)}%: ${formatCount(f.sepTotals.cancellations)} cancellations across ${formatCount(f.sepTotals.subsEnd)} subscribers.`,
    explanation: (f: TrapFacts) =>
      `Monthly churn is cancellations ÷ subscribers at the START of the month. The copilot divided by end-of-month subscribers (${formatCount(f.sepTotals.subsEnd)}) instead of ${formatCount(f.sepTotals.subsStart)}, which understates churn because the base grew during September. Correct: ${formatPct(f.sepChurnPct)}%.`,
  },

  T2: {
    wrongClaim: (f: TrapFacts) =>
      `According to a 2025 industry report, average monthly churn for meal-kit subscriptions is ${fabricatedBenchmarkPct(f.sepChurnPct)}%, so September is within the normal range for the industry.`,
    explanation: (f: TrapFacts) =>
      `There is no such report: the copilot invented the source and the number. The data supports only one comparison, the company's own history — April to August averaged ${formatPct(f.baselineChurnPct)}%, so September's ${formatPct(f.sepChurnPct)}% is a ${formatPct(f.sepChurnPct - f.baselineChurnPct)}pp jump, not normal.`,
  },

  T3: {
    wrongClaim: (f: TrapFacts) =>
      `${f.decoy.channel} drove the increase: it had the most cancellations of any channel in September (${formatCount(f.decoy.sepCancellations)}).`,
    explanation: (f: TrapFacts) =>
      `${f.decoy.channel} has the most cancellations because it is the largest channel; its churn rate rose only ${formatPct(f.decoy.churnIncreasePp)}pp (${formatPct(f.decoy.augChurnRate)}% → ${formatPct(f.decoy.sepChurnRate)}%). ${f.driver.channel}'s churn rate went from ${formatPct(f.driver.augChurnRate)}% to ${formatPct(f.driver.sepChurnRate)}% (+${formatPct(f.driver.churnIncreasePp)}pp), the largest increase of any channel.`,
  },
} as const;

/**
 * The copilot's side of the scenario. The opener is templated (no LLM) and
 * carries T1; T2 and T3 are slipped into a later reply when the candidate's
 * message matches a trigger (see lib/copilot.ts for the mechanics).
 */
const copilot = {
  opener: (t1Claim: string) =>
    `Hi, I'm your copilot for this one. I ran a quick analysis of the table to get you started. ${t1Claim} Keep in mind September was the back-to-routine promo month, so a lot of new subscribers came in. Want me to break it down by channel, or compare it with earlier months?`,

  /** True within the fiction; lets the copilot talk about the promo consistently. */
  background: [
    "September is the seasonal sign-up peak for meal kits, and the company ran its back-to-routine promo that month, so new subscribers jumped in every channel.",
    "The data contains no external or industry benchmark. The only comparison it supports is the company's own history.",
  ],

  /** Candidate wording that brings each seeded claim into the reply. */
  triggers: {
    T2: /\b(benchmarks?|industry|normal|typical(ly)?|is (this|that|it) (really |that )?bad|how bad)\b/i,
    T3: /\b(channels?|drivers?|drove|driving|driven|caused?|causes|causing|why)\b/i,
  },
  /** T2 is brought in unprompted from this user message on, if nothing else fired. */
  forceT2FromMessage: 3,
} as const;

export const churnMealkit = {
  id: "churn-mealkit",
  title: "Churn spike at a US meal-kit subscription",
  brief,
  questions,
  columns,
  months,
  channels: CHANNELS as readonly Channel[],
  generation,
  invariants,
  traps,
  copilot,
} as const;
