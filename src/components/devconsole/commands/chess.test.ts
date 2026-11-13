import { describe, expect, it } from "vitest";
import { openingsTable } from "./chess";

describe("openingsTable", () => {
  it("aligns columns and marks both-color rows", () => {
    const lines = openingsTable([
      { name: "Scandinavian Defense", color: "black", games: 9, w: 4, l: 4, d: 1, scorePct: 50, ecoUrl: null },
      { name: "Other", color: "both", games: 142, w: 65, l: 68, d: 9, scorePct: 48.9, ecoUrl: null },
    ]);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("opening               color  games     w-l-d   score");
    expect(lines[1]).toBe("Scandinavian Defense  B          9     4-4-1     50%");
    expect(lines[2]).toBe("Other                 W+B      142   65-68-9   48.9%");
  });
  it("handles no openings", () => {
    expect(openingsTable([])).toEqual(["no openings yet"]);
  });
});
