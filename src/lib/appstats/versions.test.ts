import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { mkApp, mkVersion, NOW, resetIds, resolvedBatch } from "./fixtures";
import { factorStats, pBestByMonteCarlo, priorFor, versionStats } from "./versions";

const C = DEFAULT_CONFIG;

describe("versionStats", () => {
  beforeEach(resetIds);

  it("empty data: prior only, no best", () => {
    const s = versionStats([], [], NOW, C, 1);
    expect(s.versions).toEqual([]);
    expect(s.prior).toEqual({ a0: 0.5, b0: 9.5, recentred: false });
    expect(s.resolvedTotal).toBe(0);
  });

  it("one live version with no data is the best by default", () => {
    const s = versionStats([mkVersion("v1")], [], NOW, C, 1);
    expect(s.versions[0]).toMatchObject({ n: 0, k: 0, pBest: 1, retire: false, promote: false, live: true });
    expect(s.versions[0].mean).toBeCloseTo(0.05, 10);
  });

  it("all pending rows resolve nothing", () => {
    const apps = [mkApp({ appliedAt: "2026-11-12T00:00:00.000Z" }), mkApp({ appliedAt: "2026-11-11T00:00:00.000Z" })];
    const s = versionStats([mkVersion("v1")], apps, NOW, C, 1);
    expect(s.resolvedTotal).toBe(0);
    expect(s.versions[0].n).toBe(0);
  });

  it("a version with zero positives keeps the prior's weight", () => {
    const s = versionStats([mkVersion("v1")], resolvedBatch("v1", 10, 0), NOW, C, 1);
    const v = s.versions[0];
    expect(v).toMatchObject({ n: 10, k: 0 });
    expect(v.mean).toBeCloseTo(0.5 / 20, 10);
    expect(v.interval[0]).toBeGreaterThanOrEqual(0);
    expect(v.interval[1]).toBeLessThan(0.1);
  });

  it("worked example: 2 of 40 against 5 of 40 gives P(second better) near 0.88", () => {
    const apps = [...resolvedBatch("v1", 40, 2), ...resolvedBatch("v2", 40, 5)];
    const s = versionStats([mkVersion("v1"), mkVersion("v2")], apps, NOW, C, 42);
    const v2 = s.versions.find((v) => v.id === "v2")!;
    expect(s.resolvedTotal).toBe(80);
    expect(s.prior.recentred).toBe(true);
    expect(v2.n).toBe(40);
    expect(v2.k).toBe(5);
    // The model's figure uses the stated prior; the re-centred prior (rate 7/80) moves it only slightly.
    const direct = pBestByMonteCarlo(
      [
        { id: "a", a: 0.5 + 2, b: 9.5 + 38 },
        { id: "b", a: 0.5 + 5, b: 9.5 + 35 },
      ],
      42
    );
    expect(direct.get("b")!).toBeGreaterThan(0.86);
    expect(direct.get("b")!).toBeLessThan(0.9);
    expect(v2.pBest!).toBeGreaterThan(0.84);
    expect(v2.pBest!).toBeLessThan(0.92);
  });

  it("excludes tailored, referral and withdrawn rows and retired versions from P(best)", () => {
    const apps = [
      ...resolvedBatch("v1", 5, 5),
      ...resolvedBatch("v2", 5, 0),
      ...resolvedBatch("v1", 3, 3, { tailored: true }),
      ...resolvedBatch("v2", 3, 3, { referral: true }),
      ...resolvedBatch("v3", 4, 4),
    ];
    const s = versionStats([mkVersion("v1"), mkVersion("v2"), mkVersion("v3", { status: "retired" })], apps, NOW, C, 5);
    const byId = Object.fromEntries(s.versions.map((v) => [v.id, v]));
    expect(byId.v1.n).toBe(5);
    expect(byId.v2.n).toBe(5);
    expect(byId.v3.pBest).toBeNull();
    expect(byId.v3.live).toBe(false);
    expect(byId.v1.pBest! + byId.v2.pBest!).toBeCloseTo(1, 10);
    expect(byId.v1.pBest!).toBeGreaterThan(0.95);
  });

  it("retire and promote flags need n >= 25", () => {
    const apps = [...resolvedBatch("v1", 30, 0), ...resolvedBatch("v2", 30, 12)];
    const s = versionStats([mkVersion("v1"), mkVersion("v2")], apps, NOW, C, 9);
    const byId = Object.fromEntries(s.versions.map((v) => [v.id, v]));
    expect(byId.v1.retire).toBe(true);
    expect(byId.v2.promote).toBe(true);
    const small = versionStats([mkVersion("v1"), mkVersion("v2")], [...resolvedBatch("v1", 10, 0), ...resolvedBatch("v2", 10, 8)], NOW, C, 9);
    expect(small.versions.every((v) => !v.retire && !v.promote)).toBe(true);
  });

  it("V stats use the 14 day human-visit window", () => {
    const apps = [
      mkApp({ sessions: [{ at: "2026-10-02T00:00:00.000Z", cls: "human" }] }),
      mkApp({ sessions: [{ at: "2026-10-02T00:00:00.000Z", cls: "unknown" }] }),
      mkApp({ appliedAt: "2026-11-12T00:00:00.000Z" }),
    ];
    const s = versionStats([mkVersion("v1")], apps, NOW, C, 1);
    expect(s.versions[0]).toMatchObject({ nV: 2, kV: 1, pBestV: 1 });
  });
});

describe("priorFor", () => {
  it("re-centres after 50 resolved rows keeping the sum", () => {
    expect(priorFor(3, 49, C)).toEqual({ a0: 0.5, b0: 9.5, recentred: false });
    const p = priorFor(5, 50, C);
    expect(p.recentred).toBe(true);
    expect(p.a0 + p.b0).toBeCloseTo(10, 10);
    expect(p.a0).toBeCloseTo(1, 10);
    expect(priorFor(0, 100, C).a0).toBeCloseTo(0.1, 10);
  });
});

describe("factorStats", () => {
  beforeEach(resetIds);

  it("is empty until three versions have existed", () => {
    const vs = [mkVersion("v1", { factors: { summary: "on" } }), mkVersion("v2", { factors: { summary: "off" } })];
    expect(factorStats(vs, resolvedBatch("v1", 5, 1), NOW, C)).toEqual([]);
  });

  it("pools rows by factor level across versions", () => {
    const vs = [
      mkVersion("v1", { factors: { summary: "on", length: "1 page" } }),
      mkVersion("v2", { factors: { summary: "off", length: "1 page" } }),
      mkVersion("v3", { factors: { summary: "on", length: "2 page" }, status: "retired" }),
    ];
    const apps = [...resolvedBatch("v1", 10, 2), ...resolvedBatch("v2", 10, 1), ...resolvedBatch("v3", 10, 3)];
    const f = factorStats(vs, apps, NOW, C);
    const on = f.find((x) => x.factor === "summary" && x.level === "on")!;
    expect(on).toMatchObject({ n: 20, k: 5, versions: ["v1", "v3"] });
    expect(on.mean).toBeCloseTo(5.5 / 30, 10);
    const one = f.find((x) => x.factor === "length" && x.level === "1 page")!;
    expect(one).toMatchObject({ n: 20, k: 3 });
  });
});
