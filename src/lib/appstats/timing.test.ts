import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { mkApp, NOW, resetIds } from "./fixtures";
import { kaplanMeier, timingByAts } from "./timing";
import type { ApplicationInput } from "./types";

const C = DEFAULT_CONFIG;

function respondedOn(day: number, extra: Partial<ApplicationInput> = {}): ApplicationInput {
  return mkApp({
    appliedAt: "2026-10-01T00:00:00.000Z",
    events: [{ type: "rejection", at: new Date(Date.UTC(2026, 9, 1 + day)).toISOString(), auto: false }],
    ...extra,
  });
}

describe("kaplanMeier", () => {
  beforeEach(resetIds);

  it("empty data", () => {
    const km = kaplanMeier([], NOW, C);
    expect(km).toEqual({ points: [{ day: 0, survival: 1, atRisk: 0, events: 0 }], medianDays: null, day90: null, responses: 0, n: 0 });
  });

  it("all pending: a flat curve of censored rows", () => {
    const km = kaplanMeier([mkApp({ appliedAt: "2026-11-10T00:00:00.000Z" }), mkApp({ appliedAt: "2026-11-11T00:00:00.000Z" })], NOW, C);
    expect(km.points).toHaveLength(1);
    expect(km.medianDays).toBeNull();
    expect(km.n).toBe(2);
  });

  it("hand-computed curve with censoring", () => {
    // Responses on days 2, 2, 5; one row censored at day 3 (applied 3 days before now, no response); one censored at 43.
    const apps = [
      respondedOn(2),
      respondedOn(2),
      respondedOn(5),
      mkApp({ appliedAt: "2026-11-10T12:00:00.000Z" }),
      mkApp({ appliedAt: "2026-10-01T00:00:00.000Z" }),
    ];
    const km = kaplanMeier(apps, NOW, C);
    expect(km.points.map((p) => [p.day, p.atRisk, p.events])).toEqual([
      [0, 5, 0],
      [2, 5, 2],
      [5, 2, 1],
    ]);
    expect(km.points[1].survival).toBeCloseTo(0.6, 10);
    expect(km.points[2].survival).toBeCloseTo(0.3, 10);
    expect(km.medianDays).toBe(5);
    expect(km.day90).toBeNull();
    expect(km.responses).toBe(3);
  });

  it("day90 appears once 20 responses exist", () => {
    const apps: ApplicationInput[] = [];
    for (let i = 0; i < 17; i++) apps.push(respondedOn(1 + (i % 3)));
    apps.push(respondedOn(10));
    apps.push(respondedOn(20));
    apps.push(respondedOn(25));
    const km = kaplanMeier(apps, NOW, C);
    expect(km.responses).toBe(20);
    // 17 of 20 by day 3 (0.85, short), 18 of 20 by day 10 (0.9): day90 is 10.
    expect(km.day90).toBe(10);
    expect(kaplanMeier(apps.slice(0, 19), NOW, C).day90).toBeNull();
    expect(km.medianDays).toBe(2);
  });

  it("withdrawn rows are censored at the withdrawal", () => {
    const apps = [
      respondedOn(4),
      mkApp({
        appliedAt: "2026-10-01T00:00:00.000Z",
        events: [{ type: "withdrawn", at: "2026-10-03T00:00:00.000Z", auto: false }],
      }),
    ];
    const km = kaplanMeier(apps, NOW, C);
    expect(km.points[1]).toMatchObject({ day: 4, atRisk: 1, events: 1 });
  });

  it("splits by ATS", () => {
    const by = timingByAts([respondedOn(1, { ats: "lever" }), respondedOn(3, { ats: "greenhouse" })], NOW, C);
    expect(Object.keys(by)).toEqual(["greenhouse", "lever"]);
    expect(by.lever.medianDays).toBe(1);
    expect(by.greenhouse.medianDays).toBe(3);
  });
});
