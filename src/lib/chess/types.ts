export type ChessOutcome = "W" | "L" | "D";
export type ChessColor = "white" | "black";

/** One row of chess_games (migrations/0003_chess_games.sql). */
export interface ChessGameRow {
  game_url: string;
  /** Unix seconds. */
  end_time: number;
  time_class: string;
  my_color: ChessColor;
  /** Rating after the game. */
  my_rating: number;
  /** Raw chess.com result code for my side. */
  my_result: string;
  outcome: ChessOutcome;
  opp_username: string;
  opp_rating: number;
  eco_url: string | null;
  opening_name: string | null;
  final_fen: string;
  last_move_from: string | null;
  last_move_to: string | null;
  /** Derived fields (migration 0004); null on rows not yet re-ingested. */
  opp_result: string | null;
  termination: ChessTermination | null;
  eco: string | null;
  opening_family: string | null;
  ply_count: number | null;
  time_control: string | null;
  cc_accuracy_me: number | null;
  cc_accuracy_opp: number | null;
  pgn: string | null;
}

export const TERMINATIONS = [
  "checkmate",
  "resign",
  "timeout",
  "abandoned",
  "stalemate",
  "repetition",
  "agreed",
  "insufficient",
  "other",
] as const;
export type ChessTermination = (typeof TERMINATIONS)[number];

import type {
  ActivityCell,
  ColorStats,
  EndingStats,
  ExpectationStats,
  OpeningStat,
  SeriesPoint,
  StreakInfo,
} from "./stats";

/** Board replay for one game, generated server-side from the stored PGN. */
export interface ChessReplay {
  /** sans[i] is ply i + 1. */
  sans: string[];
  /** fens[0] is the start position, fens[i] the position after ply i. */
  fens: string[];
  /** [from, to] squares per ply. */
  lastMoves: [string, string][];
}

/** A game as the card shows it (last game, best win). */
export interface ChessGameView {
  url: string;
  endTime: number;
  myColor: ChessColor;
  outcome: ChessOutcome;
  oppRating: number;
  opening: string | null;
  openingUrl: string | null;
  fen: string;
  /** Null when the row has no PGN yet (stored before migration 0004). */
  replay: ChessReplay | null;
}

/** Filled by phase 6c (move review); null until then. */
export type ChessReview = Record<string, unknown>;

export interface ChessHistoryPoint {
  /** Unix seconds of the last game that day. */
  t: number;
  r: number;
}

export interface ChessSummary {
  ok: boolean;
  profileUrl: string;
  /** stats.chess_rapid.last.rating, else the latest stored game's rating. */
  rating: number | null;
  /** First my_rating on or after trackSince. */
  startRating: number | null;
  /** max(my_rating) since trackSince. */
  peak: number | null;
  goal: number;
  /** Since trackSince. */
  record: { win: number; loss: number; draw: number };
  /** Last rating per UTC day since backfillSince, oldest first, max 180 points. */
  history: ChessHistoryPoint[];
  deltas: { d30: number | null; sinceTrack: number | null; fromLow: number | null };
  /**
   * What d30 was measured against: the latest game with end_time <= now - 30 d,
   * or, when none is stored (fallback), the earliest stored game. The card
   * labels a fallback "Since <Mon D>" instead of "30 days".
   */
  d30Ref: { t: number; rating: number; fallback: boolean } | null;
  /** min(my_rating) since backfillSince, earliest occurrence. */
  low: { rating: number; t: number } | null;
  lastGame: ChessGameView | null;
  /** Highest-rated opponent beaten since trackSince. */
  bestWin: ChessGameView | null;
  /** One point per UTC day with games since backfillSince, oldest first. */
  series: SeriesPoint[];
  /** Last 10 outcomes, newest last. */
  form: ChessOutcome[];
  streak: StreakInfo;
  colorSplit: Record<ChessColor, ColorStats>;
  openings: OpeningStat[];
  endings: EndingStats;
  expectation: ExpectationStats;
  /** One cell per day over the last 12 weeks, oldest first. */
  activity: ActivityCell[];
  review: ChessReview | null;
  /** Unix ms. */
  fetchedAt: number;
}

export const HISTORY_MAX_POINTS = 180;
