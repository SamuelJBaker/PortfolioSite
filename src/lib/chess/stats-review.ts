import { CLASSES, type ClassCounts, type MoveClass } from "./classify";
import type { ChessOutcome } from "./types";

/**
 * Pure statistics over review rows (chess_reviews joined to chess_games).
 * Our own analysis from the local Stockfish script; never chess.com labels.
 */

export interface ReviewedGameRow {
  /** Unix seconds. */
  endTime: number;
  outcome: ChessOutcome;
  /** Mean move accuracy for my side, book moves excluded; null when every move was book. */
  accMe: number | null;
  countsMe: ClassCounts;
}

export interface ReviewAccPoint {
  /** YYYY-MM-DD (UTC) of the game. */
  date: string;
  acc: number;
  outcome: ChessOutcome;
}

export interface ReviewAggregate {
  games: number;
  avgAcc: number | null;
  avgAccWins: number | null;
  avgAccLosses: number | null;
  /** Each class per 100 of my moves across the window. */
  countsPer100: Partial<Record<MoveClass, number>>;
  /** One point per reviewed game in the window, oldest first. */
  accSeries: ReviewAccPoint[];
}

export const REVIEW_WINDOW = 30;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mean(values: number[]): number | null {
  return values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export function totalMoves(counts: ClassCounts): number {
  return CLASSES.reduce((s, c) => s + (counts[c] ?? 0), 0);
}

/** Newest first. */
export function sortedReviews(rows: readonly ReviewedGameRow[]): ReviewedGameRow[] {
  return rows.slice().sort((a, b) => b.endTime - a.endTime);
}

/** Aggregate over the newest `window` reviewed games. */
export function reviewAggregate(rows: readonly ReviewedGameRow[], window = REVIEW_WINDOW): ReviewAggregate {
  const recent = sortedReviews(rows).slice(0, window);
  const withAcc = recent.filter((r) => r.accMe !== null);
  const acc = (filter: (r: ReviewedGameRow) => boolean) => mean(withAcc.filter(filter).map((r) => r.accMe as number));

  const totals: ClassCounts = {};
  let moves = 0;
  for (const r of recent) {
    for (const c of CLASSES) totals[c] = (totals[c] ?? 0) + (r.countsMe[c] ?? 0);
    moves += totalMoves(r.countsMe);
  }
  const countsPer100: Partial<Record<MoveClass, number>> = {};
  if (moves > 0) for (const c of CLASSES) if (totals[c]) countsPer100[c] = round1(((totals[c] ?? 0) / moves) * 100);

  const accSeries = withAcc
    .slice()
    .sort((a, b) => a.endTime - b.endTime)
    .map((r) => ({ date: new Date(r.endTime * 1000).toISOString().slice(0, 10), acc: round1(r.accMe as number), outcome: r.outcome }));

  return {
    games: recent.length,
    avgAcc: acc(() => true),
    avgAccWins: acc((r) => r.outcome === "W"),
    avgAccLosses: acc((r) => r.outcome === "L"),
    countsPer100,
    accSeries,
  };
}

/**
 * Blunders per game over the newest window, and over the window before it
 * when that window is complete (so the comparison is like for like).
 */
export function blundersPerGame(rows: readonly ReviewedGameRow[], window = REVIEW_WINDOW): { current: number | null; previous: number | null } {
  const sorted = sortedReviews(rows);
  const rate = (slice: ReviewedGameRow[]) =>
    slice.length ? round1(slice.reduce((s, r) => s + (r.countsMe.blunder ?? 0), 0) / slice.length) : null;
  const current = rate(sorted.slice(0, window));
  const prevSlice = sorted.slice(window, window * 2);
  const previous = prevSlice.length === window ? rate(prevSlice) : null;
  return { current, previous };
}
