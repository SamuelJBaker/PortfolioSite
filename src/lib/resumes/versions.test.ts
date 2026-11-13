import { describe, expect, it } from "vitest";
import { activeLimitError, factorsToText, parseFactors, parseFactorsJson, slugify } from "./versions";

describe("resume versions", () => {
  it("slugifies labels", () => {
    expect(slugify("V2: Summary On (1 page)")).toBe("v2-summary-on-1-page");
    expect(slugify("  --x--  ")).toBe("x");
  });

  it("parses factor lines and round-trips", () => {
    expect(parseFactors("summary=on\nProject_Order: ecs-first\n\n")).toEqual({ factors: { summary: "on", project_order: "ecs-first" } });
    expect(parseFactors("nonsense")).toEqual({ error: 'Factor line "nonsense" must be name=level.' });
    expect(factorsToText(JSON.stringify({ summary: "on", length: "1 page" }))).toBe("summary=on\nlength=1 page");
    expect(parseFactorsJson("{bad")).toEqual({});
    expect(parseFactorsJson(null)).toEqual({});
  });

  it("limits live plus default versions to three", () => {
    const vs = [
      { id: "a", status: "live" as const },
      { id: "b", status: "default" as const },
      { id: "c", status: "live" as const },
      { id: "d", status: "retired" as const },
    ];
    expect(activeLimitError(vs, "e", "live")).toMatch(/At most 3/);
    expect(activeLimitError(vs, "e", "retired")).toBeNull();
    expect(activeLimitError(vs, "a", "default")).toBeNull();
    expect(activeLimitError(vs, "d", "live")).toMatch(/At most 3/);
  });
});
