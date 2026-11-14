import "server-only";
import { roundTo } from "./format";
import { createRng, type Rng } from "./rng";
import { churnMealkit as scenario, type TrapFacts } from "./scenarios/churn-mealkit";
import { churnPct, sum } from "./scenarios/metrics";
import { CHANNELS } from "./scenarios/types";
import type {
  Channel,
  ChannelFacts,
  DatasetRow,
  GroundTruth,
  PublicData,
  Traps,
  Variant,
} from "./scenarios/types";

/**
 * About 7 in 10 draws satisfy every invariant (the worst of 20,000 seeds
 * needed 9), so running out of draws is not a realistic event.
 */
const MAX_DRAWS = 500;

/**
 * seed → one concrete variant of scenario 1, in three separate parts:
 *
 *   publicData   the brief + 24-row dataset. Safe to send to the browser.
 *   groundTruth  the correct answers.            Server-only.
 *   traps        the copilot's three seeded errors. Server-only.
 *
 * This module is server-only, so groundTruth and traps cannot be imported into
 * a client component; pass `publicData` down as props instead.
 *
 * Deterministic: the same seed always produces byte-identical output. Attempts
 * store just the seed, so changing this algorithm changes every existing
 * attempt's data — the pinned hashes in variant.test.ts will tell you.
 */
export function buildVariant(seed: number): Variant {
  if (!Number.isInteger(seed)) {
    throw new Error(`Variant seed must be an integer, got ${seed}`);
  }
  const rng = createRng(seed);

  // Rejection sampling: draw a plausible dataset, keep the first one that
  // satisfies every scenario invariant. Redraws continue the same PRNG stream,
  // so the result is still a pure function of the seed.
  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    const dataset = drawDataset(rng);
    const facts = analyze(dataset);
    if (meetsInvariants(dataset, facts)) {
      return {
        seed,
        publicData: toPublicData(dataset),
        groundTruth: toGroundTruth(facts),
        traps: toTraps(facts),
      };
    }
  }
  throw new Error(`No valid variant for seed ${seed} after ${MAX_DRAWS} draws`);
}

const MONTH_KEYS = scenario.months.map((m) => m.key);
const AUG = MONTH_KEYS[MONTH_KEYS.length - 2];
const SEP = MONTH_KEYS[MONTH_KEYS.length - 1];

// ---------------------------------------------------------------------------
// 1. Draw a dataset
// ---------------------------------------------------------------------------

type ChannelPlan = {
  startingSubs: number;
  baseChurnPct: number;
  grossAddsPct: number;
  /** September churn = August churn + this, in percentage points. */
  sepChangePp: number;
  revenuePerSub: number;
};

function drawDataset(rng: Rng): DatasetRow[] {
  const g = scenario.generation;

  // Cast the channels into roles. Row order stays canonical, so position in
  // the table says nothing about which channel is which.
  const [largest, spiking, otherA, otherB] = rng.shuffle(CHANNELS);

  const total = rng.int(...g.startingSubscribers);
  const largestShare = rng.float(...g.share.largest);
  const spikingShare = rng.float(...g.share.spiking);
  const rest = 1 - largestShare - spikingShare;
  const otherAShare = rest * rng.float(...g.share.firstOtherShareOfRest);
  const sepGrossAddsBoostPp = rng.float(...g.sepGrossAddsBoostPp);

  const plan = (share: number, churn: readonly [number, number], spikes: boolean): ChannelPlan => ({
    startingSubs: Math.round(total * share),
    baseChurnPct: rng.float(...churn),
    grossAddsPct: rng.float(...g.grossAddsPct),
    sepChangePp: rng.float(...(spikes ? g.sepChangePp.spiking : g.sepChangePp.everyoneElse)),
    revenuePerSub: rng.float(...g.revenuePerSubscriber),
  });

  const plans: Record<Channel, ChannelPlan> = {
    [largest]: plan(largestShare, g.baseChurnPct.largest, false),
    [spiking]: plan(spikingShare, g.baseChurnPct.spiking, true),
    [otherA]: plan(otherAShare, g.baseChurnPct.other, false),
    [otherB]: plan(rest - otherAShare, g.baseChurnPct.other, false),
  } as Record<Channel, ChannelPlan>;

  // Roll the subscriber base forward month by month. Counts are integers and
  // each month starts where the previous one ended, so the table reconciles.
  const subs = new Map(CHANNELS.map((c) => [c, plans[c].startingSubs]));
  const lastChurnPct = new Map<Channel, number>();
  const rows: DatasetRow[] = [];

  for (const month of MONTH_KEYS) {
    for (const channel of CHANNELS) {
      const p = plans[channel];
      const churnPct =
        month === SEP
          ? lastChurnPct.get(channel)! + p.sepChangePp
          : p.baseChurnPct + rng.float(-g.churnNoisePp, g.churnNoisePp);
      const addsPct =
        p.grossAddsPct +
        rng.float(-g.grossAddsNoisePp, g.grossAddsNoisePp) +
        (month === SEP ? sepGrossAddsBoostPp : 0);
      const revenuePerSub = p.revenuePerSub * (1 + rng.float(-g.revenueNoise, g.revenueNoise));

      const subsStart = subs.get(channel)!;
      const cancellations = Math.round((subsStart * churnPct) / 100);
      const newSubs = Math.round((subsStart * addsPct) / 100);
      const subsEnd = subsStart + newSubs - cancellations;

      rows.push({
        month,
        channel,
        subs_start: subsStart,
        new_subs: newSubs,
        cancellations,
        subs_end: subsEnd,
        revenue: Math.round(((subsStart + subsEnd) / 2) * revenuePerSub),
      });

      subs.set(channel, subsEnd);
      lastChurnPct.set(channel, churnPct);
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 2. Compute the facts from the dataset alone (never from the drawn roles)
// ---------------------------------------------------------------------------

type Facts = {
  /** Total churn per month, in %, April → September. */
  monthlyChurnPct: number[];
  augChurnPct: number;
  sepChurnPct: number;
  sepChurnBySubsEndPct: number;
  /** Pooled April–August churn, in %. */
  baselineChurnPct: number;
  sepTotals: { subsStart: number; cancellations: number; subsEnd: number };
  /** Per channel, canonical order, unrounded. */
  channels: ChannelFacts[];
  /** Channels by Aug→Sep churn-rate increase, largest first. */
  byRateIncrease: ChannelFacts[];
  /** Channels by September cancellations, largest first. */
  byCancellations: ChannelFacts[];
};

function analyze(dataset: DatasetRow[]): Facts {
  const inMonth = (month: string) => dataset.filter((r) => r.month === month);
  const sepRows = inMonth(SEP);

  const channels: ChannelFacts[] = CHANNELS.map((channel) => {
    const aug = dataset.find((r) => r.month === AUG && r.channel === channel)!;
    const sep = dataset.find((r) => r.month === SEP && r.channel === channel)!;
    const augChurnRate = churnPct([aug]);
    const sepChurnRate = churnPct([sep]);
    return {
      channel,
      augChurnRate,
      sepChurnRate,
      churnIncreasePp: sepChurnRate - augChurnRate,
      augCancellations: aug.cancellations,
      sepCancellations: sep.cancellations,
    };
  });

  const sepTotals = {
    subsStart: sum(sepRows, (r) => r.subs_start),
    cancellations: sum(sepRows, (r) => r.cancellations),
    subsEnd: sum(sepRows, (r) => r.subs_end),
  };

  return {
    monthlyChurnPct: MONTH_KEYS.map((m) => churnPct(inMonth(m))),
    augChurnPct: churnPct(inMonth(AUG)),
    sepChurnPct: churnPct(sepRows),
    sepChurnBySubsEndPct: (sepTotals.cancellations / sepTotals.subsEnd) * 100,
    baselineChurnPct: churnPct(dataset.filter((r) => r.month !== SEP)),
    sepTotals,
    channels,
    byRateIncrease: [...channels].sort((a, b) => b.churnIncreasePp - a.churnIncreasePp),
    byCancellations: [...channels].sort((a, b) => b.sepCancellations - a.sepCancellations),
  };
}

// ---------------------------------------------------------------------------
// 3. Accept only datasets where the scenario (and each trap) actually works
// ---------------------------------------------------------------------------

function meetsInvariants(dataset: DatasetRow[], f: Facts): boolean {
  const inv = scenario.invariants;
  const [minChurn, maxChurn] = inv.churnPct;
  const inBand = (pct: number) => pct >= minChurn && pct <= maxChurn;

  // Realism: every channel-month and every monthly total is a believable rate.
  if (!dataset.every((row) => inBand(churnPct([row])))) return false;
  if (!f.monthlyChurnPct.every(inBand)) return false;

  // The story: a flat April–August, then a clear September jump.
  const baseline = f.monthlyChurnPct.slice(0, -1);
  if (Math.max(...baseline) - Math.min(...baseline) > inv.maxBaselineSpreadPp) return false;
  const increase = f.sepChurnPct - f.augChurnPct;
  if (increase < inv.sepIncreasePp[0] || increase > inv.sepIncreasePp[1]) return false;

  // T1: dividing by subs_end must give a clearly different number.
  if (Math.abs(f.sepChurnBySubsEndPct - f.sepChurnPct) < inv.minT1GapPp) return false;

  // T2: "September is normal" must be false by the company's own history.
  if (f.sepChurnPct - f.baselineChurnPct < inv.minSepAboveBaselinePp) return false;
  if (f.sepChurnPct <= Math.max(...baseline)) return false;

  // T3: the channel with the most cancellations is NOT the channel whose churn
  // rate rose the most — and neither ranking is a near-tie.
  const [driver, runnerUp] = f.byRateIncrease;
  const [decoy, nextLargest] = f.byCancellations;
  if (driver.channel === decoy.channel) return false;
  if (driver.churnIncreasePp - runnerUp.churnIncreasePp < inv.minDriverLeadPp) return false;
  if (decoy.sepCancellations < nextLargest.sepCancellations * inv.minCancellationsLead) return false;

  // ...and the driver is the driver however you slice it: it also accounts for
  // most of the extra cancellations, so Q2 has one defensible answer.
  const extra = (c: ChannelFacts) => c.sepCancellations - c.augCancellations;
  const totalExtra = sum(f.channels, extra);
  if (extra(driver) < totalExtra * inv.minDriverShareOfExtraCancellations) return false;

  return true;
}

// ---------------------------------------------------------------------------
// 4. Assemble the three parts
// ---------------------------------------------------------------------------

function toPublicData(dataset: DatasetRow[]): PublicData {
  return {
    scenarioId: scenario.id,
    title: scenario.title,
    brief: scenario.brief,
    questions: scenario.questions,
    months: scenario.months.map((m) => ({ ...m })),
    channels: scenario.channels,
    columns: scenario.columns,
    dataset,
  };
}

function toGroundTruth(f: Facts): GroundTruth {
  return {
    sepChurnRate: roundTo(f.sepChurnPct, 2),
    drivingChannel: f.byRateIncrease[0].channel,
    augChurnRate: roundTo(f.augChurnPct, 2),
    churnIncreasePp: roundTo(f.sepChurnPct - f.augChurnPct, 2),
    baselineChurnRate: roundTo(f.baselineChurnPct, 2),
    sepTotals: f.sepTotals,
    channels: f.channels.map(roundChannelFacts),
  };
}

function toTraps(f: Facts): Traps {
  const t = scenario.traps;
  const trapFacts: TrapFacts = {
    sepChurnPct: f.sepChurnPct,
    sepChurnBySubsEndPct: f.sepChurnBySubsEndPct,
    baselineChurnPct: f.baselineChurnPct,
    sepTotals: f.sepTotals,
    driver: f.byRateIncrease[0],
    decoy: f.byCancellations[0],
  };

  return {
    T1: {
      id: "T1",
      kind: "wrong_denominator",
      wrongClaim: t.T1.wrongClaim(trapFacts),
      // 1 dp, exactly as it appears in the claim, so it can be string-matched.
      trapValue: roundTo(f.sepChurnBySubsEndPct, 1),
      correctValue: roundTo(f.sepChurnPct, 2),
      explanation: t.T1.explanation(trapFacts),
    },
    T2: {
      id: "T2",
      kind: "fabricated_benchmark",
      wrongClaim: t.T2.wrongClaim(trapFacts),
      trapValue: t.fabricatedBenchmarkPct(f.sepChurnPct),
      correctValue: roundTo(f.baselineChurnPct, 2),
      explanation: t.T2.explanation(trapFacts),
    },
    T3: {
      id: "T3",
      kind: "wrong_channel",
      wrongClaim: t.T3.wrongClaim(trapFacts),
      trapValue: trapFacts.decoy.channel,
      correctValue: trapFacts.driver.channel,
      explanation: t.T3.explanation(trapFacts),
    },
  };
}

function roundChannelFacts(c: ChannelFacts): ChannelFacts {
  return {
    ...c,
    augChurnRate: roundTo(c.augChurnRate, 2),
    sepChurnRate: roundTo(c.sepChurnRate, 2),
    churnIncreasePp: roundTo(c.churnIncreasePp, 2),
  };
}
