import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { mkApp, NOW, resetIds, resolvedBatch } from "./fixtures";
import { priorityScores } from "./priority";

const C = DEFAULT_CONFIG;

const odds = (p: number) => p / (1 - p);

describe("priorityScores", () => {
  beforeEach(resetIds);

  it("empty backlog", () => {
    expect(priorityScores([], [], NOW, C)).toEqual([]);
  });

  it("with no applied rows every posting scores p0 over one hour", () => {
    const saved = [mkApp({ status: "saved", appliedAt: null, ats: "lever", effortMinutes: null })];
    const [s] = priorityScores(saved, [], NOW, C);
    expect(s.p).toBeCloseTo(0.05, 10);
    expect(s.expectedEffortHours).toBe(1);
    expect(s.score).toBeCloseTo(0.05, 10);
    expect(s.contributions).toEqual([]);
  });

  it("applies the damped odds product by hand", () => {
    // Applied rows: greenhouse 10 resolved / 4 positives (effort 60 min); lever 10 / 0 (effort 120 min). p0 = 0.2.
    const applied = [
      ...resolvedBatch("v1", 10, 4, { ats: "greenhouse", roleFamily: null, coverLetter: null, fit: null, referral: false }),
      ...resolvedBatch("v1", 10, 0, { ats: "lever", roleFamily: null, coverLetter: null, fit: null, referral: false, effortMinutes: 120 }),
    ];
    const saved = [
      mkApp({ id: 100, status: "saved", appliedAt: null, ats: "greenhouse", roleFamily: null, coverLetter: null, fit: null }),
      mkApp({ id: 101, status: "saved", appliedAt: null, ats: "lever", roleFamily: null, coverLetter: null, fit: null }),
    ];
    const scores = priorityScores(saved, applied, NOW, C);
    const p0 = 0.2;
    const ghRate = (4 + 10 * p0) / 20;
    const noRate = (4 + 10 * p0) / 30; // referral "no": all 20 rows, which shrinks to p0 exactly
    const expectedOdds = odds(p0) * Math.sqrt(odds(ghRate) / odds(p0)) * Math.sqrt(odds(noRate) / odds(p0));
    const gh = scores.find((s) => s.id === 100)!;
    expect(gh.p).toBeCloseTo(expectedOdds / (1 + expectedOdds), 10);
    expect(gh.expectedEffortHours).toBe(1);
    expect(gh.contributions.map((c) => [c.dimension, c.level])).toEqual([["ats", "greenhouse"], ["referral", "no"]]);
    const lever = scores.find((s) => s.id === 101)!;
    expect(lever.expectedEffortHours).toBe(2);
    expect(scores[0].id).toBe(100);
    expect(gh.score).toBeCloseTo(gh.p / 1, 10);
  });

  it("falls back to the overall effort under three same-ATS rows", () => {
    const applied = [...resolvedBatch("v1", 2, 0, { ats: "lever", effortMinutes: 180 }), ...resolvedBatch("v1", 4, 0, { ats: "greenhouse", effortMinutes: 30 })];
    const saved = [mkApp({ status: "saved", appliedAt: null, ats: "lever" })];
    expect(priorityScores(saved, applied, NOW, C)[0].expectedEffortHours).toBeCloseTo((2 * 3 + 4 * 0.5) / 6, 10);
  });
});
