import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { mkApp, NOW } from "./fixtures";
import { applicationOutcome, resolvedRows } from "./outcomes";

const C = DEFAULT_CONFIG;

describe("applicationOutcome", () => {
  it("saved rows are excluded with everything null", () => {
    const o = applicationOutcome(mkApp({ status: "saved", appliedAt: null, key: null }), NOW, C);
    expect(o).toMatchObject({ y: null, v: null, resolved: false, ageDays: null, excludedFromVersions: "not-applied", stage: "saved" });
  });

  it("pending within the window: unresolved, no y", () => {
    const o = applicationOutcome(mkApp({ appliedAt: "2026-11-10T00:00:00.000Z" }), NOW, C);
    expect(o.y).toBeNull();
    expect(o.resolved).toBe(false);
    expect(o.v).toBeNull();
    expect(o.stage).toBe("applied");
    expect(o.ageDays).toBeCloseTo(3.5, 5);
  });

  it("human advance inside T sets Y = 1 and resolves on that day", () => {
    const o = applicationOutcome(
      mkApp({
        appliedAt: "2026-11-01T00:00:00.000Z",
        events: [{ type: "phone_screen", at: "2026-11-08T00:00:00.000Z", auto: false }],
      }),
      NOW,
      C
    );
    expect(o).toMatchObject({ y: 1, resolved: true, ghosted: false, responded: true, stage: "phone_screen" });
    expect(o.daysToFirstResponse).toBe(7);
    expect(o.resolvedAt).toBe("2026-11-08T00:00:00.000Z");
    expect(o.advanceAt).toBe("2026-11-08T00:00:00.000Z");
  });

  it("an automatic assessment invite is a response but not an advance", () => {
    const o = applicationOutcome(
      mkApp({
        appliedAt: "2026-11-01T00:00:00.000Z",
        events: [{ type: "assessment_invite", at: "2026-11-02T00:00:00.000Z", auto: true }],
      }),
      NOW,
      C
    );
    expect(o.y).toBeNull();
    expect(o.responded).toBe(true);
    expect(o.daysToFirstResponse).toBe(1);
    expect(o.stage).toBe("assessment");
  });

  it("an advance after T days does not count; the row is ghosted at T", () => {
    const o = applicationOutcome(
      mkApp({
        appliedAt: "2026-09-01T00:00:00.000Z",
        events: [{ type: "recruiter_contact", at: "2026-10-15T00:00:00.000Z", auto: false }],
      }),
      NOW,
      C
    );
    expect(o).toMatchObject({ y: 0, resolved: true, ghosted: true });
    expect(o.resolvedAt).toBe("2026-10-01T00:00:00.000Z");
    expect(o.daysToFirstResponse).toBe(44);
  });

  it("a rejection resolves with Y = 0, not ghosted", () => {
    const o = applicationOutcome(
      mkApp({ appliedAt: "2026-11-01T00:00:00.000Z", events: [{ type: "rejection", at: "2026-11-05T06:00:00.000Z", auto: false }] }),
      NOW,
      C
    );
    expect(o).toMatchObject({ y: 0, resolved: true, ghosted: false, stage: "rejected" });
    expect(o.daysToRejection).toBeCloseTo(4.25, 6);
  });

  it("V counts only human sessions inside the V window", () => {
    const base = { appliedAt: "2026-10-01T00:00:00.000Z" };
    const bot = applicationOutcome(mkApp({ ...base, sessions: [{ at: "2026-10-02T00:00:00.000Z", cls: "bot" }] }), NOW, C);
    expect(bot.v).toBe(0);
    expect(bot.stage).toBe("applied");
    const late = applicationOutcome(mkApp({ ...base, sessions: [{ at: "2026-10-20T00:00:00.000Z", cls: "human" }] }), NOW, C);
    expect(late.v).toBe(0);
    expect(late.stage).toBe("human_visit");
    const human = applicationOutcome(mkApp({ ...base, sessions: [{ at: "2026-10-03T00:00:00.000Z", cls: "human" }] }), NOW, C);
    expect(human.v).toBe(1);
    const open = applicationOutcome(mkApp({ appliedAt: "2026-11-10T00:00:00.000Z" }), NOW, C);
    expect(open.v).toBeNull();
  });

  it("withdrawn before resolution is excluded from every rate", () => {
    const o = applicationOutcome(
      mkApp({ appliedAt: "2026-10-01T00:00:00.000Z", events: [{ type: "withdrawn", at: "2026-10-10T00:00:00.000Z", auto: false }] }),
      NOW,
      C
    );
    expect(o).toMatchObject({ y: null, resolved: false, excludedFromVersions: "withdrawn", stage: "withdrawn" });
    const afterOffer = applicationOutcome(
      mkApp({
        appliedAt: "2026-10-01T00:00:00.000Z",
        status: "withdrawn",
        events: [
          { type: "interview", at: "2026-10-10T00:00:00.000Z", auto: false },
          { type: "withdrawn", at: "2026-10-20T00:00:00.000Z", auto: false },
        ],
      }),
      NOW,
      C
    );
    expect(afterOffer.y).toBe(1);
    expect(afterOffer.excludedFromVersions).toBeNull();
    expect(afterOffer.withdrawnAt).toBeNull();
  });

  it("tailored and referral rows resolve but stay out of the version comparison", () => {
    const t = applicationOutcome(mkApp({ tailored: true }), NOW, C);
    expect(t.y).toBe(0);
    expect(t.excludedFromVersions).toBe("tailored");
    const r = applicationOutcome(mkApp({ referral: true }), NOW, C);
    expect(r.excludedFromVersions).toBe("referral");
    expect(resolvedRows([mkApp({ tailored: true }), mkApp({ appliedAt: "2026-11-12T00:00:00.000Z" })], NOW, C)).toHaveLength(1);
  });
});
