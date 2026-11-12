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
}

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
  /** min(my_rating) since backfillSince, earliest occurrence. */
  low: { rating: number; t: number } | null;
  lastGame: {
    url: string;
    endTime: number;
    myColor: ChessColor;
    outcome: ChessOutcome;
    oppRating: number;
    opening: string | null;
    fen: string;
  } | null;
  bestWin: { url: string; oppRating: number; endTime: number } | null;
  /** Unix ms. */
  fetchedAt: number;
}

export const HISTORY_MAX_POINTS = 180;
