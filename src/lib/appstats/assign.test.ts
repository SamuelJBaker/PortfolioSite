import { beforeEach, describe, expect, it } from "vitest";
import { assignVersion } from "./assign";
import { DEFAULT_CONFIG } from "./config";
import { mkApp, mkVersion, NOW, resetIds, resolvedBatch } from "./fixtures";

const C = DEFAULT_CONFIG;

describe("assignVersion", () => {
  beforeEach(resetIds);

  it("returns null with no live versions", () => {
    expect(assignVersion([mkVersion("v1", { status: "retired" })], "platform", [], NOW, C, 1)).toBeNull();
    expect(assignVersion([], "platform", [], NOW, C, 1)).toBeNull();
  });

  it("a single candidate is assigned without a floor check", () => {
    const a = assignVersion([mkVersion("v1"), mkVersion("v2", { status: "retired" })], "ml", [], NOW, C, 1);
    expect(a).toMatchObject({ versionId: "v1", reason: "single" });
    expect(Object.keys(a!.draws)).toEqual(["v1"]);
  });

  it("is deterministic per seed and draws from the posterior", () => {
    const vs = [mkVersion("v1"), mkVersion("v2")];
    const apps = [...resolvedBatch("v1", 10, 5), ...resolvedBatch("v2", 10, 5)];
    const a = assignVersion(vs, "platform", apps, NOW, C, 3);
    const b = assignVersion(vs, "platform", apps, NOW, C, 3);
    expect(a).toEqual(b);
    expect(a!.reason).toBe("draw");
    expect(a!.draws.v1).toBeGreaterThan(0);
    expect(a!.draws.v1).toBeLessThan(1);
  });

  it("a strong version wins most draws", () => {
    const vs = [mkVersion("v1"), mkVersion("v2")];
    const apps = [...resolvedBatch("v1", 10, 0), ...resolvedBatch("v2", 10, 9)];
    let v2 = 0;
    for (let seed = 0; seed < 100; seed++) {
      const a = assignVersion(vs, "platform", apps, NOW, C, seed);
      if (a!.reason === "floor") continue;
      if (a!.versionId === "v2") v2 += 1;
    }
    expect(v2).toBeGreaterThan(90);
  });

  it("the floor assigns a version under 20 percent of the last 20 random assignments", () => {
    const vs = [mkVersion("v1"), mkVersion("v2"), mkVersion("v3")];
    const apps = [
      ...resolvedBatch("v1", 12, 0, { appliedAt: "2026-10-05T00:00:00.000Z" }),
      ...resolvedBatch("v2", 10, 8, { appliedAt: "2026-10-06T00:00:00.000Z" }),
      ...resolvedBatch("v3", 3, 0, { appliedAt: "2026-10-07T00:00:00.000Z" }),
    ];
    // v3 has 3 of the last 20 (15 percent): floor.
    const a = assignVersion(vs, "platform", apps, NOW, C, 1);
    expect(a).toMatchObject({ versionId: "v3", reason: "floor" });
    expect(Object.keys(a!.draws).sort()).toEqual(["v1", "v2", "v3"]);
    // Manual assignments do not count toward the window.
    const manual = apps.map((x) => ({ ...x, assignedBy: "manual" as const }));
    expect(assignVersion(vs, "platform", manual, NOW, C, 1)!.reason).toBe("draw");
  });

  it("falls back to all families when the family has no resolved rows", () => {
    const vs = [mkVersion("v1"), mkVersion("v2")];
    const apps = [...resolvedBatch("v1", 10, 0), ...resolvedBatch("v2", 10, 9)];
    const a = assignVersion(vs, "graphics", apps, NOW, C, 4);
    expect(a!.draws.v2).toBeGreaterThan(a!.draws.v1);
  });

  it("the first ever assignment is a draw, not a floor", () => {
    const a = assignVersion([mkVersion("v1"), mkVersion("v2")], "platform", [mkApp({ status: "saved", appliedAt: null })], NOW, C, 2);
    expect(a!.reason).toBe("draw");
  });
});
