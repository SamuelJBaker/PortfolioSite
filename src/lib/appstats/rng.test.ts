import { describe, expect, it } from "vitest";
import { betaCdf, betaInterval, betaMean, betaQuantile, betaSample, gammaSample, lgamma, makeRng } from "./rng";

function moments(xs: number[]): { mean: number; variance: number } {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length;
  return { mean, variance };
}

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = makeRng(7);
    const b = makeRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(makeRng(8)()).not.toBe(makeRng(7)());
  });

  it("gamma moments match shape * scale and shape * scale^2", () => {
    const rng = makeRng(1);
    const xs = Array.from({ length: 20000 }, () => gammaSample(rng, 2.5, 2));
    const { mean, variance } = moments(xs);
    expect(mean).toBeCloseTo(5, 0);
    expect(Math.abs(variance - 10) / 10).toBeLessThan(0.1);
  });

  it("gamma with shape below one uses the boost and keeps its mean", () => {
    const rng = makeRng(2);
    const xs = Array.from({ length: 20000 }, () => gammaSample(rng, 0.5));
    expect(moments(xs).mean).toBeCloseTo(0.5, 1);
  });

  it("beta moments match a / (a + b)", () => {
    const rng = makeRng(3);
    const xs = Array.from({ length: 20000 }, () => betaSample(rng, 2.5, 47.5));
    const { mean, variance } = moments(xs);
    expect(mean).toBeCloseTo(0.05, 2);
    const expectedVar = (2.5 * 47.5) / (50 * 50 * 51);
    expect(Math.abs(variance - expectedVar) / expectedVar).toBeLessThan(0.15);
  });

  it("lgamma matches factorials", () => {
    expect(Math.exp(lgamma(5))).toBeCloseTo(24, 6);
    expect(Math.exp(lgamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 6);
  });

  it("beta cdf and quantile invert each other", () => {
    expect(betaCdf(0.5, 1, 1)).toBeCloseTo(0.5, 10);
    expect(betaQuantile(0.5, 1, 1)).toBeCloseTo(0.5, 8);
    expect(betaCdf(0.3, 2, 5)).toBeCloseTo(0.57983, 4);
    expect(betaQuantile(betaCdf(0.3, 2, 5), 2, 5)).toBeCloseTo(0.3, 8);
    expect(betaMean(2, 5)).toBeCloseTo(2 / 7, 10);
  });

  it("beta(2, 2) 80 percent interval is symmetric around one half", () => {
    const [lo, hi] = betaInterval(2, 2);
    expect(lo + hi).toBeCloseTo(1, 8);
    expect(lo).toBeLessThan(0.5);
    expect(betaCdf(lo, 2, 2)).toBeCloseTo(0.1, 8);
  });
});
