import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { mkApp, resetIds } from "./fixtures";
import { weekly, weekStartMs } from "./weekly";

const C = DEFAULT_CONFIG;
// Friday 2026-11-13; the current ISO week starts Monday 2026-11-09.
const NOW = "2026-11-13T12:00:00.000Z";

describe("weekly", () => {
  beforeEach(resetIds);

  it("week starts on the UTC Monday", () => {
    expect(new Date(weekStartMs(NOW)).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(new Date(weekStartMs("2026-11-09T00:00:00.000Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(new Date(weekStartMs("2026-11-08T23:59:59.000Z")).toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("empty data gives five empty rows, current week first", () => {
    const w = weekly([], NOW, C);
    expect(w.map((r) => r.weekStart)).toEqual(["2026-11-09", "2026-11-02", "2026-10-26", "2026-10-19", "2026-10-12"]);
    expect(w[0]).toMatchObject({ sent: 0, effortHours: 0, resolved: 0, positives: 0, humanVisits: 0, pipeline: {} });
  });

  it("buckets across the Sunday/Monday boundary and places resolutions by their own time", () => {
    const apps = [
      // Sent Sunday 8 Nov 23:00 (previous week), human visit Monday 9 Nov (current week).
      mkApp({ appliedAt: "2026-11-08T23:00:00.000Z", effortMinutes: 90, sessions: [{ at: "2026-11-09T01:00:00.000Z", cls: "human" }] }),
      // Sent 1 Oct, ghosted at 31 Oct (week of 26 Oct).
      mkApp({ appliedAt: "2026-10-01T00:00:00.000Z", effortMinutes: 30 }),
      // Sent 20 Oct (week of 19 Oct), recruiter contact 3 Nov (week of 2 Nov): resolved and positive there.
      mkApp({ appliedAt: "2026-10-20T00:00:00.000Z", events: [{ type: "recruiter_contact", at: "2026-11-03T00:00:00.000Z", auto: false }] }),
      mkApp({ status: "saved", appliedAt: null }),
    ];
    const w = weekly(apps, NOW, C);
    const by = Object.fromEntries(w.map((r) => [r.weekStart, r]));
    expect(by["2026-11-09"]).toMatchObject({ sent: 0, humanVisits: 1, resolved: 0, positives: 0 });
    expect(by["2026-11-02"]).toMatchObject({ sent: 1, effortHours: 1.5, resolved: 1, positives: 1 });
    expect(by["2026-10-26"]).toMatchObject({ sent: 0, resolved: 1, positives: 0 });
    expect(by["2026-10-19"]).toMatchObject({ sent: 1, effortHours: 1 });
    expect(by["2026-10-12"].sent).toBe(0);
    expect(w[0].pipeline).toEqual({ human_visit: 1, applied: 1, response: 1 });
    expect(w[1].pipeline).toEqual({});
  });
});
