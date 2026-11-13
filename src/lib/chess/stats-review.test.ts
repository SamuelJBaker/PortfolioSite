import { describe, expect, it } from "vitest";
import { blundersPerGame, reviewAggregate, totalMoves, type ReviewedGameRow } from "./stats-review";
import type { ChessOutcome } from "./types";

const T0 = Date.UTC(2026, 10, 1) / 1000;

function row(i: number, outcome: ChessOutcome, accMe: number | null, blunder = 0): ReviewedGameRow {
  return { endTime: T0 + i * 3600, outcome, accMe, countsMe: { best: 10, good: 5, blunder } };
}

describe("reviewAggregate", () => {
  it("averages accuracy overall and by result, counts per 100 moves, and orders the series oldest first", () => {
    const rows = [row(3, "W", 80, 1), row(1, "L", 60, 3), row(2, "D", 70, 0), row(0, "W", null, 2)];
    const a = reviewAggregate(rows);
    expect(a.games).toBe(4);
    expect(a.avgAcc).toBe(70);
    expect(a.avgAccWins).toBe(80);
    expect(a.avgAccLosses).toBe(60);
    // 4 games * 15 moves + 6 blunders = 66 moves; 40 best.
    expect(a.countsPer100.best).toBe(60.6);
    expect(a.countsPer100.blunder).toBe(9.1);
    expect(a.countsPer100.inaccuracy).toBeUndefined();
    expect(a.accSeries.map((p) => p.acc)).toEqual([60, 70, 80]);
    expect(a.accSeries[0]).toEqual({ date: "2026-11-01", acc: 60, outcome: "L" });
  });

  it("keeps only the newest window", () => {
    const rows = Array.from({ length: 40 }, (_, i) => row(i, "W", i));
    const a = reviewAggregate(rows, 30);
    expect(a.games).toBe(30);
    expect(a.accSeries[0].acc).toBe(10);
    expect(a.avgAcc).toBe(24.5);
  });

  it("is empty-safe", () => {
    expect(reviewAggregate([])).toEqual({ games: 0, avgAcc: null, avgAccWins: null, avgAccLosses: null, countsPer100: {}, accSeries: [] });
    expect(reviewAggregate([row(0, "W", null)]).avgAcc).toBeNull();
  });

  it("totals moves across classes", () => {
    expect(totalMoves({ best: 10, good: 5, blunder: 2 })).toBe(17);
    expect(totalMoves({})).toBe(0);
  });
});

describe("blundersPerGame", () => {
  it("reports the current window and the previous one only when complete", () => {
    const rows = Array.from({ length: 45 }, (_, i) => row(i, "W", 70, i < 15 ? 1 : 3));
    // Newest 30 are i = 15..44 (3 each); previous slice i = 0..14 is only 15 games: incomplete.
    expect(blundersPerGame(rows, 30)).toEqual({ current: 3, previous: null });
    const more = Array.from({ length: 60 }, (_, i) => row(i, "W", 70, i < 30 ? 1 : 3));
    expect(blundersPerGame(more, 30)).toEqual({ current: 3, previous: 1 });
    expect(blundersPerGame([], 30)).toEqual({ current: null, previous: null });
  });
});
