import { describe, expect, it } from "vitest";
import { createRng, mulberry32 } from "./rng";

describe("mulberry32", () => {
  it("is deterministic: the same seed gives the same stream", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  it("is pinned: the stream never changes between releases or machines", () => {
    const next = mulberry32(1);
    const first = [next(), next(), next()];
    expect(first).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });

  it("stays in [0, 1) and looks uniform", () => {
    const next = mulberry32(7);
    let total = 0;
    for (let i = 0; i < 10_000; i++) {
      const x = next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      total += x;
    }
    expect(total / 10_000).toBeCloseTo(0.5, 1);
  });

  it("gives different streams for neighbouring seeds", () => {
    const firsts = new Set(Array.from({ length: 1000 }, (_, seed) => mulberry32(seed)()));
    expect(firsts.size).toBe(1000);
  });
});

describe("createRng", () => {
  it("int() is inclusive on both ends and never leaves the range", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("float() stays inside [min, max)", () => {
    const rng = createRng(4);
    for (let i = 0; i < 2000; i++) {
      const x = rng.float(4.6, 5.8);
      expect(x).toBeGreaterThanOrEqual(4.6);
      expect(x).toBeLessThan(5.8);
    }
  });

  it("shuffle() returns a permutation and leaves the input alone", () => {
    const rng = createRng(5);
    const input = ["a", "b", "c", "d"] as const;
    const out = rng.shuffle(input);
    expect([...out].sort()).toEqual(["a", "b", "c", "d"]);
    expect(input).toEqual(["a", "b", "c", "d"]);
  });

  it("shuffle() reaches every ordering", () => {
    const rng = createRng(6);
    const orders = new Set<string>();
    for (let i = 0; i < 2000; i++) orders.add(rng.shuffle(["a", "b", "c", "d"]).join(""));
    expect(orders.size).toBe(24);
  });
});
