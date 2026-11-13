import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { mkApp, NOW, resetIds } from "./fixtures";
import { funnel } from "./funnel";
import { betaInterval } from "./rng";

const C = DEFAULT_CONFIG;

describe("funnel", () => {
  beforeEach(resetIds);

  it("empty data", () => {
    const f = funnel([], NOW, C);
    expect(f.rows.map((r) => r.count)).toEqual([0, 0, 0, 0, 0]);
    expect(f.rows.every((r) => r.fromPrevious === null)).toBe(true);
    expect(f.unresolved).toBe(0);
  });

  it("counts stages and conversion intervals", () => {
    const applied = "2026-10-01T00:00:00.000Z";
    const apps = [
      mkApp({ appliedAt: applied, sessions: [{ at: "2026-10-02T00:00:00.000Z", cls: "human" }], events: [
        { type: "phone_screen", at: "2026-10-05T00:00:00.000Z", auto: false },
        { type: "interview", at: "2026-10-12T00:00:00.000Z", auto: false },
        { type: "offer", at: "2026-10-20T00:00:00.000Z", auto: false },
      ] }),
      mkApp({ appliedAt: applied, sessions: [{ at: "2026-10-25T00:00:00.000Z", cls: "human" }], events: [{ type: "rejection", at: "2026-10-09T00:00:00.000Z", auto: false }] }),
      mkApp({ appliedAt: applied, sessions: [{ at: "2026-10-02T00:00:00.000Z", cls: "bot" }] }),
      mkApp({ appliedAt: "2026-11-12T00:00:00.000Z" }),
      mkApp({ status: "saved", appliedAt: null }),
    ];
    const f = funnel(apps, NOW, C);
    expect(f.rows.map((r) => [r.stage, r.count])).toEqual([
      ["applied", 4],
      ["human_visit", 2],
      ["response", 2],
      ["interview", 1],
      ["offer", 1],
    ]);
    expect(f.rows[0].fromPrevious).toBeNull();
    expect(f.rows[1].fromPrevious!.rate).toBe(0.5);
    expect(f.rows[1].fromPrevious!.interval).toEqual(betaInterval(2.5, 2.5));
    expect(f.rows[4].fromPrevious!.rate).toBe(1);
    expect(f.unresolved).toBe(1);
  });
});
