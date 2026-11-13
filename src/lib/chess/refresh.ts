import { chess } from "@/content/chess";
import type { CacheKv } from "@/lib/cache";
import { delay, fetchJson } from "@/lib/http";
import { mapArchive, type ArchiveResponse } from "./ingest";
import type { ClassCounts } from "./classify";
import { replayFromPgn } from "./replay";
import { blundersPerGame, reviewAggregate, type ReviewedGameRow } from "./stats-review";
import { monthStartSec, summarize } from "./summary";
import type { ChessGameReview, ChessGameRow, ChessGameView, ChessMoveReview, ChessReview, ChessSummary } from "./types";

/**
 * Server-side refresh and backfill for the chess card. Every chess.com call
 * goes through fetchJson (User-Agent, timeout, ETag via KV) and runs serially.
 */

export interface ChessEnv {
  ANALYTICS_DB: D1Database;
  ANALYTICS_KV: KVNamespace;
}

export const CHESS_SUMMARY_KEY = "chess:summary:v1";
export const CHESS_FRESH_SEC = 600;
export const CHESS_STALE_SEC = 86400;
const API = "https://api.chess.com/pub/player";
const BACKFILL_GAP_MS = 250;
const BATCH_SIZE = 50;

export const CHESS_FALLBACK: ChessSummary = {
  ok: false,
  profileUrl: `https://www.chess.com/member/${chess.username}`,
  rating: null,
  startRating: null,
  peak: null,
  goal: chess.goalRating,
  record: { win: 0, loss: 0, draw: 0 },
  history: [],
  deltas: { d30: null, sinceTrack: null, fromLow: null },
  d30Ref: null,
  low: null,
  lastGame: null,
  bestWin: null,
  series: [],
  form: [],
  streak: { current: { kind: null, length: 0 }, bestWin: 0 },
  colorSplit: {
    white: { games: 0, w: 0, l: 0, d: 0, scorePct: 0 },
    black: { games: 0, w: 0, l: 0, d: 0, scorePct: 0 },
  },
  openings: [],
  endings: { wins: {}, losses: {}, draws: {} },
  expectation: { games: 0, actual: 0, expected: 0, delta: 0 },
  activity: [],
  review: null,
  fetchedAt: 0,
};

interface StatsResponse {
  [key: string]: { last?: { rating?: number } } | undefined;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY/MM" archive path segments for a UTC date. */
export function archiveMonth(d: Date): string {
  return `${d.getUTCFullYear()}/${pad2(d.getUTCMonth() + 1)}`;
}

/** Months from "YYYY-MM" through the month of `now`, oldest first. */
export function monthsSince(yyyyMm: string, now: Date): string[] {
  const [y, m] = yyyyMm.split("-").map(Number);
  const out: string[] = [];
  let year = y;
  let month = m;
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth() + 1;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}/${pad2(month)}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return out;
}

export async function fetchStatsRating(kv: CacheKv): Promise<number | null> {
  const { data } = await fetchJson<StatsResponse>(`${API}/${chess.username}/stats`, {
    kv,
    etagKey: "chess:etag:stats",
  });
  const rating = data[`chess_${chess.timeClass}`]?.last?.rating;
  return typeof rating === "number" ? rating : null;
}

export async function fetchArchiveRows(kv: CacheKv, month: string): Promise<ChessGameRow[]> {
  const { data } = await fetchJson<ArchiveResponse>(`${API}/${chess.username}/games/${month}`, {
    kv,
    etagKey: `chess:etag:archive:${month}`,
  });
  return mapArchive(data, chess.username, chess.timeClass);
}

const ROW_COLUMNS = [
  "game_url", "end_time", "time_class", "my_color", "my_rating", "my_result", "outcome",
  "opp_username", "opp_rating", "eco_url", "opening_name", "final_fen", "last_move_from", "last_move_to",
  "opp_result", "termination", "eco", "opening_family", "ply_count", "time_control",
  "cc_accuracy_me", "cc_accuracy_opp", "pgn",
] as const satisfies readonly (keyof ChessGameRow)[];

/** Columns a re-ingest may change on an existing row (the derived set from migration 0004). */
const DERIVED_COLUMNS = [
  "opp_result", "termination", "eco", "opening_family", "ply_count", "time_control",
  "cc_accuracy_me", "cc_accuracy_opp", "pgn",
] as const;

/**
 * Upsert in batches, keyed on game_url. New rows insert; existing rows get
 * their derived columns refreshed (so a backfill re-run is the re-derive).
 * Returns the number of newly inserted rows.
 */
export async function upsertRows(db: D1Database, rows: ChessGameRow[]): Promise<number> {
  const stmt = db.prepare(
    `INSERT INTO chess_games (${ROW_COLUMNS.join(", ")})
     VALUES (${ROW_COLUMNS.map(() => "?").join(", ")})
     ON CONFLICT(game_url) DO UPDATE SET ${DERIVED_COLUMNS.map((c) => `${c} = excluded.${c}`).join(", ")}`
  );
  const existing = new Set<string>();
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const found = await db
      .prepare(`SELECT game_url FROM chess_games WHERE game_url IN (${slice.map(() => "?").join(", ")})`)
      .bind(...slice.map((r) => r.game_url))
      .all<{ game_url: string }>();
    for (const f of found.results ?? []) existing.add(f.game_url);
    await db.batch(slice.map((r) => stmt.bind(...ROW_COLUMNS.map((c) => r[c]))));
  }
  return rows.filter((r) => !existing.has(r.game_url)).length;
}

export async function readRows(db: D1Database): Promise<ChessGameRow[]> {
  const result = await db
    .prepare(
      `SELECT ${ROW_COLUMNS.join(", ")}
       FROM chess_games WHERE time_class = ? AND end_time >= ? ORDER BY end_time`
    )
    .bind(chess.timeClass, monthStartSec(chess.backfillSince))
    .all<ChessGameRow>();
  return result.results ?? [];
}

interface ReviewDbRow {
  game_url: string;
  engine: string;
  depth: number;
  acc_me: number | null;
  acc_opp: number | null;
  counts_me: string;
  counts_opp: string;
  moves: string;
  reviewed_at: number;
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** Review rows (chess_reviews) for the stored games, newest game first. */
export async function readReviews(db: D1Database): Promise<Map<string, ReviewDbRow>> {
  const result = await db
    .prepare(
      `SELECT r.game_url, r.engine, r.depth, r.acc_me, r.acc_opp, r.counts_me, r.counts_opp, r.moves, r.reviewed_at
       FROM chess_reviews r JOIN chess_games g ON g.game_url = r.game_url
       WHERE g.time_class = ? AND g.end_time >= ? ORDER BY g.end_time DESC`
    )
    .bind(chess.timeClass, monthStartSec(chess.backfillSince))
    .all<ReviewDbRow>();
  return new Map((result.results ?? []).map((r) => [r.game_url, r]));
}

function gameReview(row: ChessGameRow, r: ReviewDbRow | undefined): ChessGameReview | null {
  if (!r) return null;
  return {
    accMe: r.acc_me,
    accOpp: r.acc_opp,
    ccAccMe: row.cc_accuracy_me,
    ccAccOpp: row.cc_accuracy_opp,
    countsMe: parseJson<ClassCounts>(r.counts_me, {}),
    countsOpp: parseJson<ClassCounts>(r.counts_opp, {}),
    moves: parseJson<ChessMoveReview[]>(r.moves, []),
    engine: r.engine,
    depth: r.depth,
  };
}

/** The summary's review block from the stored rows and their reviews; null with no reviews. */
export function buildReviewBlock(rows: ChessGameRow[], reviews: Map<string, ReviewDbRow>): ChessReview | null {
  if (reviews.size === 0) return null;
  const reviewed: ReviewedGameRow[] = [];
  let newest: ReviewDbRow | null = null;
  for (const row of rows) {
    const r = reviews.get(row.game_url);
    if (!r) continue;
    reviewed.push({ endTime: row.end_time, outcome: row.outcome, accMe: r.acc_me, countsMe: parseJson<ClassCounts>(r.counts_me, {}) });
    if (!newest || r.reviewed_at > newest.reviewed_at) newest = r;
  }
  if (!newest) return null;
  return {
    coverage: { reviewed: reviewed.length, total: rows.length },
    engine: newest.engine,
    depth: newest.depth,
    aggregate: reviewAggregate(reviewed),
    blundersPerGame: blundersPerGame(reviewed),
  };
}

function withDetail(view: ChessGameView | null, rows: ChessGameRow[], reviews: Map<string, ReviewDbRow>): ChessGameView | null {
  if (!view) return null;
  const row = rows.find((r) => r.game_url === view.url);
  return { ...view, replay: replayFromPgn(row?.pgn), review: row ? gameReview(row, reviews.get(row.game_url)) : null };
}

/** Summary from D1 alone (admin page, and after stats were fetched), with replays and reviews attached. */
export async function summarizeFromDb(db: D1Database, statsRating: number | null, now = new Date()): Promise<ChessSummary> {
  const rows = await readRows(db);
  const reviews = await readReviews(db);
  const summary = summarize(rows, { rating: statsRating }, chess, Math.floor(now.getTime() / 1000));
  return {
    ...summary,
    lastGame: withDetail(summary.lastGame, rows, reviews),
    bestWin: withDetail(summary.bestWin, rows, reviews),
    review: buildReviewBlock(rows, reviews),
  };
}

/**
 * load() for chess:summary:v1: stats, then the current month's archive (and
 * the previous month's on the 1st and 2nd), upsert, then summarize from D1.
 * Any upstream failure throws so cached() serves stale.
 */
export async function loadChessSummary(env: ChessEnv, now = new Date()): Promise<ChessSummary> {
  const kv = env.ANALYTICS_KV;
  const rating = await fetchStatsRating(kv);

  const months = [archiveMonth(now)];
  if (now.getUTCDate() <= 2) {
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    months.unshift(archiveMonth(prev));
  }
  const rows: ChessGameRow[] = [];
  for (const month of months) rows.push(...(await fetchArchiveRows(kv, month)));
  await upsertRows(env.ANALYTICS_DB, rows);

  return summarizeFromDb(env.ANALYTICS_DB, rating, now);
}

export interface BackfillMonth {
  month: string;
  /** Rows the archive mapped to (rated games in the tracked time class). */
  mapped: number;
  /** Rows that were new to D1. */
  inserted: number;
}

export interface BackfillResult {
  since: string;
  months: string[];
  inserted: number;
  detail: BackfillMonth[];
  /** chess_games state after the walk. */
  stored: { count: number; firstEndTime: number | null; lastEndTime: number | null };
}

export function isYearMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/**
 * Walks every archive month from `since` (default backfillSince) to now,
 * serially, 250 ms apart. INSERT OR IGNORE on game_url, so re-running is
 * safe; months already fetched return 304 through the stored ETag.
 */
export async function backfill(env: ChessEnv, since: string = chess.backfillSince, now = new Date()): Promise<BackfillResult> {
  const months = monthsSince(since, now);
  const detail: BackfillMonth[] = [];
  let inserted = 0;
  for (let i = 0; i < months.length; i++) {
    if (i > 0) await delay(BACKFILL_GAP_MS);
    const rows = await fetchArchiveRows(env.ANALYTICS_KV, months[i]);
    const n = await upsertRows(env.ANALYTICS_DB, rows);
    inserted += n;
    detail.push({ month: months[i], mapped: rows.length, inserted: n });
  }
  // The next GET /api/chess recomputes with the new rows.
  await env.ANALYTICS_KV.delete(CHESS_SUMMARY_KEY);

  const stored = await env.ANALYTICS_DB.prepare(
    "SELECT COUNT(*) AS count, MIN(end_time) AS first_end, MAX(end_time) AS last_end FROM chess_games WHERE time_class = ?"
  )
    .bind(chess.timeClass)
    .first<{ count: number; first_end: number | null; last_end: number | null }>();

  return {
    since,
    months,
    inserted,
    detail,
    stored: { count: stored?.count ?? 0, firstEndTime: stored?.first_end ?? null, lastEndTime: stored?.last_end ?? null },
  };
}
