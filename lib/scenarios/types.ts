/**
 * Types shared by the scenario engine. Apart from the public channel list this
 * file is types only, so it is safe to import from client components. The
 * *values* behind `GroundTruth` and `Traps` only ever exist in server-only
 * modules (lib/variant.ts, lib/scenarios/churn-mealkit.ts).
 */

export const CHANNELS = ["Paid Social", "Search", "Referral", "Partnerships"] as const;
export type Channel = (typeof CHANNELS)[number];

/** One row of the dataset. Keys match the CSV column names the candidate sees. */
export type DatasetRow = {
  /** ISO month, e.g. "2026-09". */
  month: string;
  channel: Channel;
  subs_start: number;
  new_subs: number;
  cancellations: number;
  /** Always exactly subs_start + new_subs - cancellations. */
  subs_end: number;
  /** USD, whole dollars. */
  revenue: number;
};

export type DatasetColumn = {
  key: keyof DatasetRow;
  label: string;
  kind: "month" | "text" | "count" | "usd";
};

export type Brief = {
  from: string;
  role: string;
  company: string;
  subject: string;
  paragraphs: string[];
  /** How the company defines the columns and metrics in the table. */
  dataNotes: string[];
  /** The numbered asks the answer form mirrors. */
  asks: string[];
};

export type AnswerQuestion =
  | { id: "q1"; kind: "percent"; label: string; hint: string }
  | { id: "q2"; kind: "channel"; label: string; hint: string }
  | { id: "q3" | "q4"; kind: "text"; label: string; hint: string; maxWords: number };

/** Everything the browser may see. Contains no answers and no trap values. */
export type PublicData = {
  scenarioId: string;
  title: string;
  brief: Brief;
  questions: AnswerQuestion[];
  months: { key: string; label: string }[];
  channels: readonly Channel[];
  columns: DatasetColumn[];
  /** 24 rows: 6 months × 4 channels, ordered by month then channel. */
  dataset: DatasetRow[];
};

/** Per-channel facts behind the answer, in percent / percentage points. */
export type ChannelFacts = {
  channel: Channel;
  augChurnRate: number;
  sepChurnRate: number;
  /** sepChurnRate - augChurnRate, in percentage points. */
  churnIncreasePp: number;
  augCancellations: number;
  sepCancellations: number;
};

/** SERVER-ONLY. The correct answers, computed from the dataset. */
export type GroundTruth = {
  /** Q1. September churn across all channels, in % (2 dp): cancellations / subs_start. */
  sepChurnRate: number;
  /** Q2. The channel with the largest Aug→Sep churn-rate increase. */
  drivingChannel: Channel;

  // Supporting facts: for the copilot's "otherwise accurate" context and the Proof page.
  augChurnRate: number;
  /** September minus August total churn, in percentage points. */
  churnIncreasePp: number;
  /** Pooled Apr–Aug churn, in %: the company's own "normal". */
  baselineChurnRate: number;
  sepTotals: { subsStart: number; cancellations: number; subsEnd: number };
  channels: ChannelFacts[];
};

type TrapBase<Id extends string, Value> = {
  id: Id;
  /** The exact false statement the copilot is made to assert. */
  wrongClaim: string;
  /** The wrong value inside the claim: what a fooled candidate would repeat. */
  trapValue: Value;
  /** What the candidate should have arrived at instead. */
  correctValue: Value;
  /** Plain-language reason the claim is wrong (shown on the Proof page). */
  explanation: string;
};

/** T1: September churn computed with subs_end as the denominator. Values in %. */
export type WrongDenominatorTrap = TrapBase<"T1", number> & { kind: "wrong_denominator" };
/**
 * T2: an invented industry benchmark that makes September look normal.
 * trapValue = the fake benchmark (%); correctValue = the company's own Apr–Aug
 * baseline (%), the only comparison the data actually supports.
 */
export type FabricatedBenchmarkTrap = TrapBase<"T2", number> & { kind: "fabricated_benchmark" };
/** T3: blames the channel with the most cancellations instead of the largest rate increase. */
export type WrongChannelTrap = TrapBase<"T3", Channel> & { kind: "wrong_channel" };

export type Trap = WrongDenominatorTrap | FabricatedBenchmarkTrap | WrongChannelTrap;
export type TrapId = Trap["id"];

/** SERVER-ONLY. The errors the copilot is seeded with for this variant. */
export type Traps = {
  T1: WrongDenominatorTrap;
  T2: FabricatedBenchmarkTrap;
  T3: WrongChannelTrap;
};

export type Variant = {
  seed: number;
  /** Safe to send to the browser. */
  publicData: PublicData;
  /** Server-only. */
  groundTruth: GroundTruth;
  /** Server-only. */
  traps: Traps;
};
