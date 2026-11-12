import { describe, expect, it } from "vitest";
import { monthStartSec, summarize } from "./summary";
import type { ChessGameRow, ChessOutcome } from "./types";

const config = { username: "darthcracker", goalRating: 1200, trackSince: "2026-11", backfillSince: "2026-10" };
const OCT = monthStartSec("2026-10");
const NOV = monthStartSec("2026-11");
const DAY = 86400;

let n = 0;
function row(end_time: number, my_rating: number, outcome: ChessOutcome = "W", opp_rating = 600): ChessGameRow {
  n++;
  return {
    game_url: `https://www.chess.com/game/live/${n}`,
    end_time,
    time_class: "rapid",
    my_color: n % 2 ? "white" : "black",
    my_rating,
    my_result: outcome === "W" ? "win" : outcome === "D" ? "agreed" : "resigned",
    outcome,
    opp_username: "opp",
    opp_rating,
    eco_url: null,
    opening_name: "Englund Gambit",
    final_fen: "8/8/8/8/8/8/8/8 w - - 0 1",
    last_move_from: null,
    last_move_to: null,
  };
}

describe("monthStartSec", () => {
  it("is 00:00 UTC on the first", () => {
    expect(new Date(NOV * 1000).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("summarize", () => {
  const rows = [
    row(OCT + 20 * DAY + 100, 500, "L"), // Oct 21, low
    row(OCT + 20 * DAY + 200, 486, "L"), // Oct 21 later: day's last rating 486, the low
    row(OCT + 25 * DAY, 550, "W", 540), // Oct 26
    row(NOV + 1 * DAY, 560, "W", 700), // Nov 2: first tracked game, best win
    row(NOV + 1 * DAY + 10, 575, "D"),
    row(NOV + 9 * DAY, 640, "W", 620), // Nov 10, peak
    row(NOV + 11 * DAY, 620, "L", 650), // Nov 12, last game
  ];
  const now = NOV + 11 * DAY + 3600;
  const s = summarize(rows, { rating: 625 }, config, now);

  it("uses the stats rating and tracks start, peak and record since trackSince", () => {
    expect(s.ok).toBe(true);
    expect(s.rating).toBe(625);
    expect(s.startRating).toBe(560);
    expect(s.peak).toBe(640);
    expect(s.record).toEqual({ win: 2, loss: 1, draw: 1 });
    expect(s.goal).toBe(1200);
    expect(s.profileUrl).toBe("https://www.chess.com/member/darthcracker");
  });

  it("keeps the last rating per UTC day since backfillSince, oldest first", () => {
    expect(s.history).toEqual([
      { t: OCT + 20 * DAY + 200, r: 486 },
      { t: OCT + 25 * DAY, r: 550 },
      { t: NOV + 1 * DAY + 10, r: 575 },
      { t: NOV + 9 * DAY, r: 640 },
      { t: NOV + 11 * DAY, r: 620 },
    ]);
  });

  it("finds the low with its time and the three deltas", () => {
    expect(s.low).toEqual({ rating: 486, t: OCT + 20 * DAY + 200 });
    // 30 days before now is Oct 13 + 1h: no game on or before it, so the
    // earliest stored game (Oct 21, 500) is the fallback reference.
    expect(s.deltas).toEqual({ d30: 625 - 500, sinceTrack: 625 - 560, fromLow: 625 - 486 });
    expect(s.d30Ref).toEqual({ t: OCT + 20 * DAY + 100, rating: 500, fallback: true });
    const later = summarize(rows, { rating: 625 }, config, NOV + 25 * DAY);
    // 30 days before Nov 26 is Oct 27: the latest game not after it is Oct 26 (550).
    expect(later.deltas.d30).toBe(625 - 550);
    expect(later.d30Ref).toEqual({ t: OCT + 25 * DAY, rating: 550, fallback: false });
  });

  it("d30 uses the latest game on or before the cutoff, not the day's close", () => {
    // Two games on Oct 21; the cutoff falls between them.
    const cutoffNow = OCT + 20 * DAY + 150 + 30 * DAY;
    const r = summarize(rows, { rating: 625 }, config, cutoffNow);
    expect(r.d30Ref).toEqual({ t: OCT + 20 * DAY + 100, rating: 500, fallback: false });
    expect(r.deltas.d30).toBe(125);
  });

  it("single game: d30 falls back to that game, low is that game", () => {
    const one = [row(NOV + 3 * DAY, 571, "L")];
    const r = summarize(one, { rating: 571 }, config, NOV + 5 * DAY);
    expect(r.d30Ref).toEqual({ t: NOV + 3 * DAY, rating: 571, fallback: true });
    expect(r.deltas).toEqual({ d30: 0, sinceTrack: 0, fromLow: 0 });
    expect(r.low).toEqual({ rating: 571, t: NOV + 3 * DAY });
  });

  it("from-low ignores games before backfillSince", () => {
    const r = summarize([row(OCT - 2 * DAY, 300, "L"), ...rows], { rating: 625 }, config, now);
    expect(r.low).toEqual({ rating: 486, t: OCT + 20 * DAY + 200 });
    expect(r.deltas.fromLow).toBe(625 - 486);
  });

  it("reports the last game and the best win since trackSince", () => {
    expect(s.lastGame).toMatchObject({ endTime: NOV + 11 * DAY, outcome: "L", oppRating: 650, opening: "Englund Gambit" });
    expect(s.bestWin).toMatchObject({ oppRating: 700, endTime: NOV + 1 * DAY });
    expect(s.fetchedAt).toBe(now * 1000);
  });

  it("falls back to the latest stored rating when stats are missing", () => {
    expect(summarize(rows, { rating: null }, config, now).rating).toBe(620);
  });

  it("ignores rows before backfillSince and handles the empty case", () => {
    const empty = summarize([row(OCT - DAY, 700)], { rating: null }, config, now);
    expect(empty.history).toEqual([]);
    expect(empty).toMatchObject({ rating: null, startRating: null, peak: null, low: null, lastGame: null, bestWin: null });
    expect(empty.deltas).toEqual({ d30: null, sinceTrack: null, fromLow: null });
    expect(empty.d30Ref).toBeNull();
    expect(empty.record).toEqual({ win: 0, loss: 0, draw: 0 });
  });

  it("with games only before trackSince: history but no start, peak or record", () => {
    const only = summarize(rows.slice(0, 3), { rating: 550 }, config, now);
    expect(only.history).toHaveLength(2);
    expect(only).toMatchObject({ startRating: null, peak: null, record: { win: 0, loss: 0, draw: 0 } });
    expect(only.deltas).toEqual({ d30: 550 - 500, sinceTrack: null, fromLow: 550 - 486 });
  });

  it("caps history at 180 points, keeping the most recent", () => {
    const many: ChessGameRow[] = [];
    for (let d = 0; d < 200; d++) many.push(row(OCT + d * DAY, 500 + d));
    const h = summarize(many, { rating: 700 }, config, OCT + 200 * DAY).history;
    expect(h).toHaveLength(180);
    expect(h[0].r).toBe(520);
    expect(h[179].r).toBe(699);
  });
});

describe("backfill month helpers", () => {
  it("isYearMonth accepts YYYY-MM only", async () => {
    const { isYearMonth, monthsSince } = await import("./refresh");
    expect(isYearMonth("2026-10")).toBe(true);
    expect(isYearMonth("2026-13")).toBe(false);
    expect(isYearMonth("2026-1")).toBe(false);
    expect(isYearMonth(202610)).toBe(false);
    expect(monthsSince("2025-11", new Date(Date.UTC(2026, 0, 15)))).toEqual(["2025/11", "2025/12", "2026/01"]);
    expect(monthsSince("2026-11", new Date(Date.UTC(2026, 10, 12)))).toEqual(["2026/11"]);
  });
});
