/**
 * Seeded PRNG. Every attempt stores only its seed; the dataset, ground truth
 * and trap values are regenerated from it on demand, so the stream must be
 * identical on every machine and every run. Only integer math and + - * /
 * are used anywhere downstream (no Math.random, Date, or transcendental
 * functions, whose results can differ between engines).
 */

/** mulberry32: 32-bit state, uniform floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** A shuffled copy (Fisher–Yates); the input is not mutated. */
  shuffle<T>(items: readonly T[]): T[];
};

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const float = (min: number, max: number) => min + next() * (max - min);
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, float, int, shuffle };
}
