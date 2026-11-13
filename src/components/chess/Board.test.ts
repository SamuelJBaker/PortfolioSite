import { describe, expect, it } from "vitest";
import { moveLabel, squareCell } from "./Board";

describe("moveLabel", () => {
  const sans = ["e4", "e5", "Nf3", "Nc6"];
  it("numbers white and black plies", () => {
    expect(moveLabel(0, sans)).toBe("Start position");
    expect(moveLabel(1, sans)).toBe("1. e4");
    expect(moveLabel(2, sans)).toBe("1... e5");
    expect(moveLabel(3, sans)).toBe("2. Nf3");
    expect(moveLabel(4, sans)).toBe("2... Nc6");
    expect(moveLabel(5, sans)).toBe("Start position");
  });
});

describe("squareCell", () => {
  it("maps squares for the white view and flips for black", () => {
    expect(squareCell("a1", "white")).toEqual({ row: 7, col: 0 });
    expect(squareCell("h8", "white")).toEqual({ row: 0, col: 7 });
    expect(squareCell("e4", "white")).toEqual({ row: 4, col: 4 });
    expect(squareCell("a1", "black")).toEqual({ row: 0, col: 7 });
    expect(squareCell("e4", "black")).toEqual({ row: 3, col: 3 });
    expect(squareCell("z9", "white")).toBeNull();
  });
});
