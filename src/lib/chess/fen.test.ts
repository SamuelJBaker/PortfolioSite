import { describe, expect, it } from "vitest";
import { orientBoard, parseFenBoard } from "./fen";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("parseFenBoard", () => {
  it("parses the start position from the first field only", () => {
    const b = parseFenBoard(START)!;
    expect(b).toHaveLength(8);
    expect(b[0]).toEqual(["r", "n", "b", "q", "k", "b", "n", "r"]);
    expect(b[1]).toEqual(Array(8).fill("p"));
    expect(b[4]).toEqual(Array(8).fill(null));
    expect(b[7]).toEqual(["R", "N", "B", "Q", "K", "B", "N", "R"]);
  });

  it("expands digit runs inside a rank", () => {
    const b = parseFenBoard("8/8/5q2/5k1K/8/8/8/8 w - - 30 81")!;
    expect(b[2]).toEqual([null, null, null, null, null, "q", null, null]);
    expect(b[3]).toEqual([null, null, null, null, null, "k", null, "K"]);
  });

  it("rejects malformed fields", () => {
    expect(parseFenBoard("8/8/8/8/8/8/8 w - - 0 1")).toBeNull();
    expect(parseFenBoard("9/8/8/8/8/8/8/8 w - - 0 1")).toBeNull();
    expect(parseFenBoard("x7/8/8/8/8/8/8/8 w - - 0 1")).toBeNull();
    expect(parseFenBoard("")).toBeNull();
  });
});

describe("orientBoard", () => {
  it("keeps white as is and flips both axes for black", () => {
    const b = parseFenBoard(START)!;
    expect(orientBoard(b, "white")).toBe(b);
    const flipped = orientBoard(b, "black");
    expect(flipped[0]).toEqual(["R", "N", "B", "K", "Q", "B", "N", "R"]);
    expect(flipped[7]).toEqual(["r", "n", "b", "k", "q", "b", "n", "r"]);
  });
});
