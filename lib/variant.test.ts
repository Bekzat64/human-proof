import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHANNELS } from "./scenarios/types";
import type { Channel, DatasetRow, Variant } from "./scenarios/types";
import { buildVariant } from "./variant";

/**
 * The scenario's guarantees, checked for seeds 1..1000.
 *
 * Everything here is re-derived from the raw 24-row dataset with its own few
 * lines of arithmetic. It deliberately does not reuse the generator's helpers,
 * so a bug in variant.ts cannot vouch for itself.
 */

const SEEDS = Array.from({ length: 1000 }, (_, i) => i + 1);
const variants = SEEDS.map((seed) => buildVariant(seed));

const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const AUG = "2026-08";
const SEP = "2026-09";

const total = (rows: DatasetRow[], key: "subs_start" | "cancellations" | "subs_end") =>
  rows.reduce((sum, row) => sum + row[key], 0);

/** Churn in %: cancellations ÷ subscribers at the start of the month. */
const churn = (rows: DatasetRow[]) => (100 * total(rows, "cancellations")) / total(rows, "subs_start");

const month = (v: Variant, key: string) => v.publicData.dataset.filter((r) => r.month === key);
const cell = (v: Variant, key: string, channel: Channel) =>
  v.publicData.dataset.find((r) => r.month === key && r.channel === channel)!;

/** The channel that maximises `score`. */
const top = (score: (channel: Channel) => number): Channel =>
  [...CHANNELS].sort((a, b) => score(b) - score(a))[0];

const churnIncrease = (v: Variant, channel: Channel) =>
  churn([cell(v, SEP, channel)]) - churn([cell(v, AUG, channel)]);

/** Seeds for which `holds` is false — so a failure names the seeds, not just "false". */
const seedsWhereNot = (holds: (v: Variant) => boolean) =>
  variants.filter((v) => !holds(v)).map((v) => v.seed);

describe("dataset", () => {
  it("has 24 rows: every month × channel once, ordered by month then channel", () => {
    const expected = MONTHS.flatMap((m) => CHANNELS.map((c) => `${m}|${c}`));
    expect(
      seedsWhereNot((v) => {
        const actual = v.publicData.dataset.map((r) => `${r.month}|${r.channel}`);
        return actual.length === 24 && actual.join() === expected.join();
      }),
    ).toEqual([]);
  });

  it("subs_end = subs_start + new_subs - cancellations, exactly, on every row", () => {
    expect(
      seedsWhereNot((v) =>
        v.publicData.dataset.every((r) => r.subs_end === r.subs_start + r.new_subs - r.cancellations),
      ),
    ).toEqual([]);
  });

  it("each month starts exactly where the previous month ended", () => {
    expect(
      seedsWhereNot((v) =>
        CHANNELS.every((channel) =>
          MONTHS.slice(1).every(
            (m, i) => cell(v, m, channel).subs_start === cell(v, MONTHS[i], channel).subs_end,
          ),
        ),
      ),
    ).toEqual([]);
  });

  it("contains only positive whole numbers", () => {
    expect(
      seedsWhereNot((v) =>
        v.publicData.dataset.every((r) =>
          [r.subs_start, r.new_subs, r.cancellations, r.subs_end, r.revenue].every(
            (n) => Number.isInteger(n) && n > 0,
          ),
        ),
      ),
    ).toEqual([]);
  });

  it("monthly churn is between 4% and 12% for every channel-month", () => {
    expect(
      seedsWhereNot((v) =>
        v.publicData.dataset.every((r) => churn([r]) >= 4 && churn([r]) <= 12),
      ),
    ).toEqual([]);
  });

  it("monthly churn is between 4% and 12% for every monthly total", () => {
    expect(
      seedsWhereNot((v) =>
        MONTHS.every((m) => churn(month(v, m)) >= 4 && churn(month(v, m)) <= 12),
      ),
    ).toEqual([]);
  });

  it("total churn rises by 1.5–4pp from August to September", () => {
    expect(
      seedsWhereNot((v) => {
        const increase = churn(month(v, SEP)) - churn(month(v, AUG));
        return increase >= 1.5 && increase <= 4;
      }),
    ).toEqual([]);
  });
});

describe("ground truth", () => {
  it("sepChurnRate is September cancellations ÷ September subs_start", () => {
    expect(
      seedsWhereNot((v) => Math.abs(v.groundTruth.sepChurnRate - churn(month(v, SEP))) <= 0.005 + 1e-9),
    ).toEqual([]);
  });

  it("drivingChannel is the channel with the largest churn-rate increase", () => {
    expect(
      seedsWhereNot((v) => v.groundTruth.drivingChannel === top((c) => churnIncrease(v, c))),
    ).toEqual([]);
  });
});

describe("trap T1 — churn computed with subs_end as the denominator", () => {
  const wrong = (v: Variant) => (100 * total(month(v, SEP), "cancellations")) / total(month(v, SEP), "subs_end");

  it("the wrong value differs from the correct value by at least 0.5pp", () => {
    expect(seedsWhereNot((v) => Math.abs(wrong(v) - churn(month(v, SEP))) >= 0.5)).toEqual([]);
  });

  it("trapValue is that wrong value, and it is still ≥0.5pp off as displayed", () => {
    expect(
      seedsWhereNot((v) => {
        const { trapValue, correctValue } = v.traps.T1;
        return (
          Math.abs(trapValue - wrong(v)) <= 0.05 + 1e-9 &&
          correctValue === v.groundTruth.sepChurnRate &&
          Math.abs(trapValue - correctValue) >= 0.5
        );
      }),
    ).toEqual([]);
  });

  it("the claim states the wrong value and not the correct one", () => {
    expect(
      seedsWhereNot((v) => {
        const { wrongClaim, trapValue, correctValue } = v.traps.T1;
        return (
          wrongClaim.includes(`${trapValue.toFixed(1)}%`) &&
          !wrongClaim.includes(`${correctValue.toFixed(1)}%`)
        );
      }),
    ).toEqual([]);
  });
});

describe("trap T2 — fabricated industry benchmark", () => {
  it("the benchmark is a round, plausible number", () => {
    expect(
      seedsWhereNot((v) => {
        const benchmark = v.traps.T2.trapValue;
        return Number.isInteger(benchmark) && benchmark >= 6 && benchmark <= 14;
      }),
    ).toEqual([]);
  });

  it("the benchmark sits above September, so trusting it suggests 'our churn is normal'", () => {
    expect(
      seedsWhereNot((v) => {
        const { trapValue, wrongClaim } = v.traps.T2;
        return (
          trapValue > churn(month(v, SEP)) &&
          wrongClaim.includes(`${trapValue}%`) &&
          wrongClaim.includes("normal")
        );
      }),
    ).toEqual([]);
  });

  it("but 'normal' is wrong: September is the worst month, ≥1.5pp above the Apr–Aug baseline", () => {
    expect(
      seedsWhereNot((v) => {
        const sep = churn(month(v, SEP));
        const earlier = MONTHS.slice(0, -1);
        const baseline = churn(earlier.flatMap((m) => month(v, m)));
        return (
          earlier.every((m) => churn(month(v, m)) < sep) &&
          sep - baseline >= 1.5 &&
          Math.abs(v.traps.T2.correctValue - baseline) <= 0.005 + 1e-9
        );
      }),
    ).toEqual([]);
  });
});

describe("trap T3 — blaming the channel with the most cancellations", () => {
  const mostCancellations = (v: Variant) => top((c) => cell(v, SEP, c).cancellations);
  const largestIncrease = (v: Variant) => top((c) => churnIncrease(v, c));

  it("most absolute September cancellations ≠ largest churn-rate increase", () => {
    expect(seedsWhereNot((v) => mostCancellations(v) !== largestIncrease(v))).toEqual([]);
  });

  it("the trap names the former; the correct value is the latter", () => {
    expect(
      seedsWhereNot((v) => {
        const { trapValue, correctValue, wrongClaim } = v.traps.T3;
        return (
          trapValue === mostCancellations(v) &&
          correctValue === largestIncrease(v) &&
          correctValue === v.groundTruth.drivingChannel &&
          wrongClaim.startsWith(trapValue)
        );
      }),
    ).toEqual([]);
  });

  it("neither ranking is a near-tie, so Q2 has one defensible answer", () => {
    expect(
      seedsWhereNot((v) => {
        const increases = CHANNELS.map((c) => churnIncrease(v, c)).sort((a, b) => b - a);
        const cancellations = CHANNELS.map((c) => cell(v, SEP, c).cancellations).sort((a, b) => b - a);
        return increases[0] - increases[1] >= 2 && cancellations[0] >= cancellations[1] * 1.05;
      }),
    ).toEqual([]);
  });
});

describe("determinism", () => {
  it("same seed → byte-identical output", () => {
    expect(
      seedsWhereNot((v) => JSON.stringify(buildVariant(v.seed)) === JSON.stringify(v)),
    ).toEqual([]);
  });

  // Attempts store only their seed and are regenerated on every page view. If
  // these hashes change, the data, answers and trap values of every existing
  // attempt and Proof page change with them — only update them if that is
  // truly what you intend. (Wording is left out on purpose: copy can be edited.)
  it("numbers are pinned across releases and machines", () => {
    const fingerprint = (v: Variant) => {
      const numbers = {
        dataset: v.publicData.dataset,
        groundTruth: v.groundTruth,
        traps: Object.values(v.traps).map((t) => [t.id, t.trapValue, t.correctValue]),
      };
      return createHash("sha256").update(JSON.stringify(numbers)).digest("hex").slice(0, 16);
    };
    expect([1, 42, 1000].map((seed) => fingerprint(buildVariant(seed)))).toEqual([
      "72db65ee6104cd00",
      "bb7b96e4b2a274c7",
      "b23ae92452104164",
    ]);
  });

  it("different seeds give different datasets", () => {
    expect(new Set(variants.map((v) => JSON.stringify(v.publicData.dataset))).size).toBe(1000);
  });

  it("every channel takes its turn as the right answer and as the decoy", () => {
    for (const channel of CHANNELS) {
      expect(variants.filter((v) => v.groundTruth.drivingChannel === channel).length).toBeGreaterThan(150);
      expect(variants.filter((v) => v.traps.T3.trapValue === channel).length).toBeGreaterThan(150);
    }
  });

  it("accepts any 32-bit integer seed and rejects anything else", () => {
    for (const seed of [0, -1, 2 ** 31 - 1, 2 ** 32 - 1, 123456789]) {
      expect(buildVariant(seed).publicData.dataset).toHaveLength(24);
    }
    expect(() => buildVariant(1.5)).toThrow();
    expect(() => buildVariant(Number.NaN)).toThrow();
  });
});

describe("what reaches the browser", () => {
  it("publicData has exactly its documented fields", () => {
    expect(Object.keys(variants[0].publicData).sort()).toEqual(
      ["brief", "channels", "columns", "dataset", "months", "questions", "scenarioId", "title"].sort(),
    );
  });

  it("publicData contains no answer and no trap wording", () => {
    expect(
      seedsWhereNot((v) => {
        const sent = JSON.stringify(v.publicData);
        const secrets = [
          "sepChurnRate",
          "drivingChannel",
          "wrongClaim",
          v.traps.T1.wrongClaim,
          v.traps.T2.wrongClaim,
          v.traps.T3.wrongClaim,
          v.traps.T1.explanation,
        ];
        return secrets.every((secret) => !sent.includes(secret));
      }),
    ).toEqual([]);
  });

  it("the modules that hold answers are marked server-only", () => {
    for (const file of ["lib/variant.ts", "lib/scenarios/churn-mealkit.ts"]) {
      expect(readFileSync(file, "utf8")).toMatch(/^import "server-only";/);
    }
  });
});
