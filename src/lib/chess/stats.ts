import type { ChessColor, ChessGameRow, ChessOutcome, ChessTermination } from "./types";

/**
 * Pure statistics over stored chess_games rows. Every function takes rows in
 * any order and sorts by end_time itself; none touches the clock except
 * where `nowSec` is a parameter.
 */

export interface SeriesPoint {
  /** UTC calendar day, YYYY-MM-DD. */
  date: string;
  /** Rating after the day's last game. */
  close: number;
  games: number;
  w: number;
  l: number;
  d: number;
}

export interface StreakInfo {
  current: { kind: ChessOutcome | null; length: number };
  /** Longest run of consecutive wins. */
  bestWin: number;
}

export interface ColorStats {
  games: number;
  w: number;
  l: number;
  d: number;
  /** Score percentage, wins plus half the draws, 0..100 with one decimal. */
  scorePct: number;
}

export interface OpeningStat extends ColorStats {
  name: string;
  color: ChessColor | "both";
  /** chess.com opening page when the ECOUrl was stored, else null. */
  ecoUrl: string | null;
}

export type TerminationCounts = Partial<Record<ChessTermination, number>>;

export interface EndingStats {
  wins: TerminationCounts;
  losses: TerminationCounts;
  draws: TerminationCounts;
}

export interface ExpectationStats {
  games: number;
  actual: number;
  expected: number;
  delta: number;
}

export interface ActivityCell {
  date: string;
  games: number;
  /** Rating change over the day: close minus the rating before the day's first game. */
  net: number;
}

const DAY_SEC = 86400;
export const FORM_LENGTH = 10;
export const OPENINGS_TOP = 6;
export const OPENINGS_MIN_GAMES = 3;
export const ACTIVITY_WEEKS = 12;

export function sortedRows(rows: readonly ChessGameRow[]): ChessGameRow[] {
  return rows.slice().sort((a, b) => a.end_time - b.end_time || a.game_url.localeCompare(b.game_url));
}

export function utcDay(tSec: number): string {
  return new Date(tSec * 1000).toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function scorePct(w: number, d: number, games: number): number {
  return games === 0 ? 0 : round1(((w + d / 2) / games) * 100);
}

function tally(rows: readonly ChessGameRow[]): ColorStats {
  let w = 0;
  let l = 0;
  let d = 0;
  for (const r of rows) {
    if (r.outcome === "W") w++;
    else if (r.outcome === "L") l++;
    else d++;
  }
  return { games: rows.length, w, l, d, scorePct: scorePct(w, d, rows.length) };
}

/** One point per UTC day with games, oldest first. */
export function buildSeries(rows: readonly ChessGameRow[]): SeriesPoint[] {
  const byDay = new Map<string, SeriesPoint>();
  for (const r of sortedRows(rows)) {
    const date = utcDay(r.end_time);
    const p = byDay.get(date) ?? { date, close: r.my_rating, games: 0, w: 0, l: 0, d: 0 };
    p.close = r.my_rating;
    p.games++;
    if (r.outcome === "W") p.w++;
    else if (r.outcome === "L") p.l++;
    else p.d++;
    byDay.set(date, p);
  }
  return [...byDay.values()];
}

/** Last `n` outcomes, newest last. */
export function formOf(rows: readonly ChessGameRow[], n = FORM_LENGTH): ChessOutcome[] {
  return sortedRows(rows)
    .slice(-n)
    .map((r) => r.outcome);
}

export function streaksOf(rows: readonly ChessGameRow[]): StreakInfo {
  const sorted = sortedRows(rows);
  let bestWin = 0;
  let run = 0;
  for (const r of sorted) {
    run = r.outcome === "W" ? run + 1 : 0;
    if (run > bestWin) bestWin = run;
  }
  if (sorted.length === 0) return { current: { kind: null, length: 0 }, bestWin };
  const kind = sorted[sorted.length - 1].outcome;
  let length = 0;
  for (let i = sorted.length - 1; i >= 0 && sorted[i].outcome === kind; i--) length++;
  return { current: { kind, length }, bestWin };
}

export function colorSplitOf(rows: readonly ChessGameRow[]): Record<ChessColor, ColorStats> {
  return {
    white: tally(rows.filter((r) => r.my_color === "white")),
    black: tally(rows.filter((r) => r.my_color === "black")),
  };
}

/**
 * Top opening families by games, one row per family and color, sorted by
 * games desc then name. Families under OPENINGS_MIN_GAMES games (across both
 * colors) and everything past the top rows fold into one "Other" row. Rows
 * without a family are counted under "Other" too.
 */
export function openingsOf(rows: readonly ChessGameRow[], top = OPENINGS_TOP, minGames = OPENINGS_MIN_GAMES): OpeningStat[] {
  const familyTotals = new Map<string, number>();
  for (const r of rows) if (r.opening_family) familyTotals.set(r.opening_family, (familyTotals.get(r.opening_family) ?? 0) + 1);

  const groups = new Map<string, { name: string; color: ChessColor; rows: ChessGameRow[]; ecoUrl: string | null }>();
  const other: ChessGameRow[] = [];
  for (const r of rows) {
    const family = r.opening_family;
    if (!family || (familyTotals.get(family) ?? 0) < minGames) {
      other.push(r);
      continue;
    }
    const key = `${family}|${r.my_color}`;
    const g = groups.get(key) ?? { name: family, color: r.my_color, rows: [], ecoUrl: null };
    g.rows.push(r);
    // The family page is the shortest stored ECOUrl in the group (closest to the family slug).
    if (r.eco_url && (!g.ecoUrl || r.eco_url.length < g.ecoUrl.length)) g.ecoUrl = r.eco_url;
    groups.set(key, g);
  }

  const ranked = [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name));
  const kept = ranked.slice(0, top);
  for (const g of ranked.slice(top)) other.push(...g.rows);

  const out: OpeningStat[] = kept.map((g) => ({ name: g.name, color: g.color, ecoUrl: g.ecoUrl, ...tally(g.rows) }));
  if (other.length) out.push({ name: "Other", color: "both", ecoUrl: null, ...tally(other) });
  return out;
}

export function endingsOf(rows: readonly ChessGameRow[]): EndingStats {
  const out: EndingStats = { wins: {}, losses: {}, draws: {} };
  for (const r of rows) {
    const bucket = r.outcome === "W" ? out.wins : r.outcome === "L" ? out.losses : out.draws;
    const term = r.termination ?? "other";
    bucket[term] = (bucket[term] ?? 0) + 1;
  }
  return out;
}

/**
 * Score against Elo expectation. Expected score per game is
 * 1 / (1 + 10^((opp - me) / 400)). The archive ratings are post-game, so
 * this uses each side's rating after the game: an approximation of the
 * pre-game expectation, usually within a few points.
 */
export function expectationOf(rows: readonly ChessGameRow[]): ExpectationStats {
  let actual = 0;
  let expected = 0;
  for (const r of rows) {
    actual += r.outcome === "W" ? 1 : r.outcome === "D" ? 0.5 : 0;
    expected += 1 / (1 + Math.pow(10, (r.opp_rating - r.my_rating) / 400));
  }
  return { games: rows.length, actual: round1(actual), expected: round1(expected), delta: round1(actual - expected) };
}

/** One cell per day for the last `weeks` weeks ending today (UTC), oldest first. */
export function activityOf(rows: readonly ChessGameRow[], nowSec: number, weeks = ACTIVITY_WEEKS): ActivityCell[] {
  const sorted = sortedRows(rows);
  const todayStart = Math.floor(nowSec / DAY_SEC) * DAY_SEC;
  const firstDay = todayStart - (weeks * 7 - 1) * DAY_SEC;

  const cells = new Map<string, ActivityCell>();
  for (let t = firstDay; t <= todayStart; t += DAY_SEC) {
    const date = utcDay(t);
    cells.set(date, { date, games: 0, net: 0 });
  }

  let prevRating: number | null = null;
  let openDay: string | null = null;
  let openBase = 0;
  for (const r of sorted) {
    const date = utcDay(r.end_time);
    const cell = cells.get(date);
    if (cell) {
      if (openDay !== date) {
        openDay = date;
        openBase = prevRating ?? r.my_rating;
      }
      cell.games++;
      cell.net = r.my_rating - openBase;
    }
    prevRating = r.my_rating;
  }
  return [...cells.values()];
}
