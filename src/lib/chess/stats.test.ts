import { describe, expect, it } from "vitest";
import { activityOf, buildSeries, colorSplitOf, endingsOf, expectationOf, formOf, openingsOf, streaksOf } from "./stats";
import type { ChessColor, ChessGameRow, ChessOutcome, ChessTermination } from "./types";

const DAY = 86400;
const T0 = Date.UTC(2026, 10, 1) / 1000; // 2026-11-01

let n = 0;
function row(
  end_time: number,
  my_rating: number,
  outcome: ChessOutcome = "W",
  extra: Partial<ChessGameRow> = {}
): ChessGameRow {
  n++;
  return {
    game_url: `https://www.chess.com/game/live/${n}`,
    end_time,
    time_class: "rapid",
    my_color: (extra.my_color ?? (n % 2 ? "white" : "black")) as ChessColor,
    my_rating,
    my_result: outcome === "W" ? "win" : outcome === "D" ? "agreed" : "resigned",
    outcome,
    opp_username: "opp",
    opp_rating: extra.opp_rating ?? my_rating,
    eco_url: extra.eco_url ?? null,
    opening_name: null,
    final_fen: "8/8/8/8/8/8/8/8 w - - 0 1",
    last_move_from: null,
    last_move_to: null,
    opp_result: null,
    termination: (extra.termination ?? null) as ChessTermination | null,
    eco: null,
    opening_family: extra.opening_family ?? null,
    ply_count: null,
    time_control: null,
    cc_accuracy_me: null,
    cc_accuracy_opp: null,
    pgn: null,
  };
}

describe("buildSeries", () => {
  it("closes each day on its last game and counts outcomes", () => {
    const rows = [row(T0 + 100, 600, "W"), row(T0 + 50, 590, "L"), row(T0 + DAY + 10, 610, "D")];
    expect(buildSeries(rows)).toEqual([
      { date: "2026-11-01", close: 600, games: 2, w: 1, l: 1, d: 0 },
      { date: "2026-11-02", close: 610, games: 1, w: 0, l: 0, d: 1 },
    ]);
  });
  it("is empty for no rows", () => {
    expect(buildSeries([])).toEqual([]);
  });
});

describe("formOf and streaksOf", () => {
  const rows = ["W", "W", "L", "W", "W", "W", "D", "L", "L", "W", "W"].map((o, i) => row(T0 + i, 600, o as ChessOutcome));
  it("returns the last ten outcomes, newest last", () => {
    expect(formOf(rows)).toEqual(["W", "L", "W", "W", "W", "D", "L", "L", "W", "W"]);
    expect(formOf(rows.slice(0, 3))).toEqual(["W", "W", "L"]);
  });
  it("finds the current streak and the best win streak", () => {
    expect(streaksOf(rows)).toEqual({ current: { kind: "W", length: 2 }, bestWin: 3 });
    expect(streaksOf(rows.slice(0, 9))).toEqual({ current: { kind: "L", length: 2 }, bestWin: 3 });
    expect(streaksOf([])).toEqual({ current: { kind: null, length: 0 }, bestWin: 0 });
    expect(streaksOf([row(T0, 600, "D")])).toEqual({ current: { kind: "D", length: 1 }, bestWin: 0 });
  });
});

describe("colorSplitOf", () => {
  it("tallies per color with score percent", () => {
    const rows = [
      row(T0, 600, "W", { my_color: "white" }),
      row(T0 + 1, 600, "D", { my_color: "white" }),
      row(T0 + 2, 600, "L", { my_color: "black" }),
    ];
    expect(colorSplitOf(rows)).toEqual({
      white: { games: 2, w: 1, l: 0, d: 1, scorePct: 75 },
      black: { games: 1, w: 0, l: 1, d: 0, scorePct: 0 },
    });
    expect(colorSplitOf([]).white).toEqual({ games: 0, w: 0, l: 0, d: 0, scorePct: 0 });
  });
});

describe("openingsOf", () => {
  it("ranks family and color groups, folds small families and the tail into Other", () => {
    const rows: ChessGameRow[] = [];
    for (let i = 0; i < 4; i++) rows.push(row(T0 + i, 600, "W", { opening_family: "Scandinavian Defense", my_color: "white", eco_url: "https://www.chess.com/openings/Scandinavian-Defense-2.exd5" }));
    for (let i = 0; i < 3; i++) rows.push(row(T0 + 10 + i, 600, "L", { opening_family: "Englund Gambit", my_color: "black", eco_url: "https://www.chess.com/openings/Englund-Gambit" }));
    rows.push(row(T0 + 20, 600, "W", { opening_family: "Reti Opening", my_color: "white" })); // under min: Other
    rows.push(row(T0 + 21, 600, "D")); // no family: Other
    const out = openingsOf(rows);
    expect(out.map((o) => [o.name, o.color, o.games, o.scorePct])).toEqual([
      ["Scandinavian Defense", "white", 4, 100],
      ["Englund Gambit", "black", 3, 0],
      ["Other", "both", 2, 75],
    ]);
    expect(out[0].ecoUrl).toBe("https://www.chess.com/openings/Scandinavian-Defense-2.exd5");
    expect(out[2].ecoUrl).toBeNull();
  });
  it("limits to the top rows", () => {
    const rows: ChessGameRow[] = [];
    for (let f = 0; f < 8; f++) for (let i = 0; i < 3 + f; i++) rows.push(row(T0 + f * 100 + i, 600, "W", { opening_family: `Family ${f} Attack`, my_color: "white" }));
    const out = openingsOf(rows);
    expect(out).toHaveLength(7);
    expect(out[0].name).toBe("Family 7 Attack");
    expect(out[6]).toMatchObject({ name: "Other", games: 3 + 4 });
  });
  it("is empty for no rows", () => {
    expect(openingsOf([])).toEqual([]);
  });
});

describe("endingsOf", () => {
  it("splits termination counts by outcome, unknown as other", () => {
    const rows = [
      row(T0, 600, "W", { termination: "checkmate" }),
      row(T0 + 1, 600, "W", { termination: "resign" }),
      row(T0 + 2, 600, "W", { termination: "resign" }),
      row(T0 + 3, 600, "L", { termination: "timeout" }),
      row(T0 + 4, 600, "L"),
      row(T0 + 5, 600, "D", { termination: "stalemate" }),
    ];
    expect(endingsOf(rows)).toEqual({
      wins: { checkmate: 1, resign: 2 },
      losses: { timeout: 1, other: 1 },
      draws: { stalemate: 1 },
    });
  });
});

describe("expectationOf", () => {
  it("sums actual and Elo-expected scores", () => {
    const rows = [
      row(T0, 600, "W", { opp_rating: 600 }), // expected 0.5
      row(T0 + 1, 600, "L", { opp_rating: 800 }), // expected 0.2403
      row(T0 + 2, 600, "D", { opp_rating: 400 }), // expected 0.7597
    ];
    const e = expectationOf(rows);
    expect(e.games).toBe(3);
    expect(e.actual).toBe(1.5);
    expect(e.expected).toBe(1.5);
    expect(e.delta).toBe(0);
    expect(expectationOf([])).toEqual({ games: 0, actual: 0, expected: 0, delta: 0 });
  });
});

describe("activityOf", () => {
  it("returns 84 cells ending today with games and net change", () => {
    const now = T0 + 20 * DAY + 3600; // 2026-11-21 01:00
    const rows = [
      row(T0 + 18 * DAY + 100, 600, "W"), // Nov 19, first stored game: base is its own rating
      row(T0 + 18 * DAY + 200, 612, "W"),
      row(T0 + 20 * DAY + 100, 590, "L"), // Nov 21: base is 612
    ];
    const cells = activityOf(rows, now);
    expect(cells).toHaveLength(84);
    expect(cells[0].date).toBe("2026-08-30");
    expect(cells[83]).toEqual({ date: "2026-11-21", games: 1, net: -22 });
    expect(cells[81]).toEqual({ date: "2026-11-19", games: 2, net: 12 });
    expect(cells[82]).toEqual({ date: "2026-11-20", games: 0, net: 0 });
  });
  it("ignores games outside the window but uses them as the base", () => {
    const now = T0 + 20 * DAY;
    const rows = [row(T0 - 100 * DAY, 500, "W"), row(T0 + 20 * DAY + 10, 530, "W")];
    const cells = activityOf(rows, now);
    expect(cells.reduce((s, c) => s + c.games, 0)).toBe(1);
    expect(cells[83]).toEqual({ date: "2026-11-21", games: 1, net: 30 });
  });
});
