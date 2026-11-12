import { chess } from "@/content/chess";
import type { CacheKv } from "@/lib/cache";
import { delay, fetchJson } from "@/lib/http";
import { mapArchive, type ArchiveResponse } from "./ingest";
import { monthStartSec, summarize } from "./summary";
import type { ChessGameRow, ChessSummary } from "./types";

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
  low: null,
  lastGame: null,
  bestWin: null,
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

/** INSERT OR IGNORE in batches; returns the number of new rows. */
export async function upsertRows(db: D1Database, rows: ChessGameRow[]): Promise<number> {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO chess_games
       (game_url, end_time, time_class, my_color, my_rating, my_result, outcome,
        opp_username, opp_rating, eco_url, opening_name, final_fen, last_move_from, last_move_to)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((r) =>
      stmt.bind(
        r.game_url, r.end_time, r.time_class, r.my_color, r.my_rating, r.my_result, r.outcome,
        r.opp_username, r.opp_rating, r.eco_url, r.opening_name, r.final_fen, r.last_move_from, r.last_move_to
      )
    );
    const results = await db.batch(batch);
    for (const res of results) inserted += res.meta?.changes ?? 0;
  }
  return inserted;
}

export async function readRows(db: D1Database): Promise<ChessGameRow[]> {
  const result = await db
    .prepare(
      `SELECT game_url, end_time, time_class, my_color, my_rating, my_result, outcome,
              opp_username, opp_rating, eco_url, opening_name, final_fen, last_move_from, last_move_to
       FROM chess_games WHERE time_class = ? AND end_time >= ? ORDER BY end_time`
    )
    .bind(chess.timeClass, monthStartSec(chess.backfillSince))
    .all<ChessGameRow>();
  return result.results ?? [];
}

/** Summary from D1 alone (admin page, and after stats were fetched). */
export async function summarizeFromDb(db: D1Database, statsRating: number | null, now = new Date()): Promise<ChessSummary> {
  const rows = await readRows(db);
  return summarize(rows, { rating: statsRating }, chess, Math.floor(now.getTime() / 1000));
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

/** Walks every archive month from backfillSince to now, serially. */
export async function backfill(env: ChessEnv, now = new Date()): Promise<{ months: string[]; inserted: number }> {
  const months = monthsSince(chess.backfillSince, now);
  let inserted = 0;
  for (let i = 0; i < months.length; i++) {
    if (i > 0) await delay(BACKFILL_GAP_MS);
    const rows = await fetchArchiveRows(env.ANALYTICS_KV, months[i]);
    inserted += await upsertRows(env.ANALYTICS_DB, rows);
  }
  // The next GET /api/chess recomputes with the new rows.
  await env.ANALYTICS_KV.delete(CHESS_SUMMARY_KEY);
  return { months, inserted };
}
