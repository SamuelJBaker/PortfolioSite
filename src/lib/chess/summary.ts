import { activityOf, buildSeries, colorSplitOf, endingsOf, expectationOf, formOf, openingsOf, streaksOf } from "./stats";
import { HISTORY_MAX_POINTS, type ChessGameRow, type ChessGameView, type ChessSummary } from "./types";

export interface SummaryConfig {
  username: string;
  goalRating: number;
  /** "YYYY-MM" */
  trackSince: string;
  /** "YYYY-MM" */
  backfillSince: string;
}

export interface SummaryStats {
  /** stats.chess_<timeClass>.last.rating, or null when stats were unavailable. */
  rating: number | null;
}

const DAY_SEC = 86400;

/** Unix seconds at 00:00 UTC on the first of "YYYY-MM". */
export function monthStartSec(yyyyMm: string): number {
  const [y, m] = yyyyMm.split("-").map(Number);
  return Date.UTC(y, m - 1, 1) / 1000;
}

/** The card's view of a row. `replay` is attached server-side (refresh.ts). */
export function gameView(r: ChessGameRow): ChessGameView {
  return {
    url: r.game_url,
    endTime: r.end_time,
    myColor: r.my_color,
    outcome: r.outcome,
    oppRating: r.opp_rating,
    opening: r.opening_name,
    openingUrl: r.eco_url,
    fen: r.final_fen,
    replay: null,
    review: null,
  };
}

/**
 * Builds the card summary from stored rows (any order) and the stats rating.
 * Pure; `nowSec` defaults to the clock. Rows before backfillSince are ignored.
 */
export function summarize(
  rows: readonly ChessGameRow[],
  stats: SummaryStats,
  config: SummaryConfig,
  nowSec: number = Math.floor(Date.now() / 1000)
): ChessSummary {
  const sinceBackfill = monthStartSec(config.backfillSince);
  const sinceTrack = monthStartSec(config.trackSince);

  const all = rows
    .filter((r) => r.end_time >= sinceBackfill)
    .slice()
    .sort((a, b) => a.end_time - b.end_time || a.game_url.localeCompare(b.game_url));
  const tracked = all.filter((r) => r.end_time >= sinceTrack);

  const last = all.length ? all[all.length - 1] : null;
  const rating = stats.rating ?? last?.my_rating ?? null;

  // Last rating per UTC day, oldest first, capped to the most recent points.
  const byDay = new Map<number, ChessGameRow>();
  for (const r of all) byDay.set(Math.floor(r.end_time / DAY_SEC), r);
  const history = [...byDay.values()].map((r) => ({ t: r.end_time, r: r.my_rating })).slice(-HISTORY_MAX_POINTS);

  let low: ChessSummary["low"] = null;
  for (const r of all) if (!low || r.my_rating < low.rating) low = { rating: r.my_rating, t: r.end_time };

  const startRating = tracked.length ? tracked[0].my_rating : null;
  const peak = tracked.length ? Math.max(...tracked.map((r) => r.my_rating)) : null;
  const record = { win: 0, loss: 0, draw: 0 };
  for (const r of tracked) {
    if (r.outcome === "W") record.win++;
    else if (r.outcome === "L") record.loss++;
    else record.draw++;
  }

  let bestWinRow: ChessGameRow | null = null;
  for (const r of tracked) {
    if (r.outcome === "W" && (!bestWinRow || r.opp_rating > bestWinRow.opp_rating)) bestWinRow = r;
  }

  // d30: rating now minus the rating after the latest game with
  // end_time <= now - 30 d. With no such game (history shorter than 30 days)
  // the earliest stored game is the reference and d30Ref.fallback is true.
  const cutoff = nowSec - 30 * DAY_SEC;
  let refGame: ChessGameRow | null = null;
  for (const r of all) if (r.end_time <= cutoff) refGame = r;
  const fallback = !refGame && all.length > 0;
  if (!refGame && all.length) refGame = all[0];
  const d30Ref = refGame ? { t: refGame.end_time, rating: refGame.my_rating, fallback } : null;
  const deltas = {
    d30: rating !== null && d30Ref ? rating - d30Ref.rating : null,
    sinceTrack: rating !== null && startRating !== null ? rating - startRating : null,
    fromLow: rating !== null && low ? rating - low.rating : null,
  };

  return {
    ok: true,
    profileUrl: `https://www.chess.com/member/${config.username}`,
    rating,
    startRating,
    peak,
    goal: config.goalRating,
    record,
    history,
    deltas,
    d30Ref,
    low,
    lastGame: last ? gameView(last) : null,
    bestWin: bestWinRow ? gameView(bestWinRow) : null,
    series: buildSeries(all),
    form: formOf(all),
    streak: streaksOf(all),
    colorSplit: colorSplitOf(all),
    openings: openingsOf(all),
    endings: endingsOf(all),
    expectation: expectationOf(all),
    activity: activityOf(all, nowSec),
    review: null,
    fetchedAt: nowSec * 1000,
  };
}
