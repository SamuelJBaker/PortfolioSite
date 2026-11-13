import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { mkApp, NOW, resetIds, resolvedBatch } from "./fixtures";
import { overallRate, postingAgeBucket, salaryBucket, salaryTerciles, segmentStats, shrunkRate } from "./segments";

const C = DEFAULT_CONFIG;

describe("segments", () => {
  beforeEach(resetIds);

  it("empty data gives no cells and the prior mean as p0", () => {
    expect(segmentStats([], NOW, C)).toEqual([]);
    expect(overallRate([], NOW, C)).toEqual({ p0: 0.05, n: 0, k: 0 });
  });

  it("shrinks a small cell toward p0 by hand", () => {
    // Overall: 20 resolved, 4 positives -> p0 = 0.2. greenhouse: 10 resolved, 4 positives; lever: 10, 0.
    const apps = [...resolvedBatch("v1", 10, 4, { ats: "greenhouse" }), ...resolvedBatch("v1", 10, 0, { ats: "lever" })];
    const cells = segmentStats(apps, NOW, C).filter((s) => s.dimension === "ats");
    const gh = cells.find((s) => s.level === "greenhouse")!;
    expect(gh).toMatchObject({ n: 10, k: 4, small: false });
    expect(gh.rate).toBeCloseTo((4 + 10 * 0.2) / 20, 10);
    expect(gh.interval[0]).toBeLessThan(gh.rate);
    expect(gh.interval[1]).toBeGreaterThan(gh.rate);
    const lever = cells.find((s) => s.level === "lever")!;
    expect(lever.rate).toBeCloseTo(2 / 20, 10);
    expect(gh.meanEffortHours).toBe(1);
    expect(gh.yieldPerHour).toBeCloseTo(gh.rate, 10);
    expect(shrunkRate(0, 0, 0.3, 10).rate).toBeCloseTo(0.3, 10);
  });

  it("flags cells under 10 rows and skips unknown levels", () => {
    const apps = [...resolvedBatch("v1", 3, 1, { workMode: "remote" }), ...resolvedBatch("v1", 4, 0)];
    const cells = segmentStats(apps, NOW, C).filter((s) => s.dimension === "workMode");
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ level: "remote", n: 3, small: true });
  });

  it("unresolved rows stay out of n but contribute effort", () => {
    const apps = [...resolvedBatch("v1", 2, 1), mkApp({ appliedAt: "2026-11-12T00:00:00.000Z", effortMinutes: 240 })];
    const cell = segmentStats(apps, NOW, C).find((s) => s.dimension === "ats")!;
    expect(cell.n).toBe(2);
    expect(cell.meanEffortHours).toBeCloseTo(2, 10);
  });

  it("buckets posting age and salary", () => {
    expect([0, 3, 4, 7, 8, 14, 15, 30, 31, null].map(postingAgeBucket)).toEqual([
      "0-3", "0-3", "4-7", "4-7", "8-14", "8-14", "15-30", "15-30", "31+", null,
    ]);
    const apps = [60, 70, 80, 90, 100, 110].map((k) => mkApp({ salaryMin: k * 1000, salaryMax: k * 1000 }));
    const t = salaryTerciles(apps);
    expect(t.cuts).toEqual([80000, 100000]);
    expect(salaryBucket(70000, t)).toBe("low");
    expect(salaryBucket(80000, t)).toBe("mid");
    expect(salaryBucket(100000, t)).toBe("high");
    expect(salaryBucket(null, t)).toBeNull();
    expect(salaryTerciles([]).cuts).toBeNull();
    const cells = segmentStats(apps, NOW, C).filter((s) => s.dimension === "salary").map((s) => [s.level, s.n]);
    expect(cells).toEqual([["high", 2], ["low", 2], ["mid", 2]]);
  });

  it("referral and fit are dimensions", () => {
    const apps = [...resolvedBatch("v1", 2, 1, { referral: true, fit: 5 }), ...resolvedBatch("v1", 2, 0, { fit: 2 })];
    const s = segmentStats(apps, NOW, C);
    expect(s.filter((x) => x.dimension === "referral").map((x) => [x.level, x.k])).toEqual([["no", 0], ["yes", 1]]);
    expect(s.filter((x) => x.dimension === "fit").map((x) => x.level)).toEqual(["2", "5"]);
  });
});
