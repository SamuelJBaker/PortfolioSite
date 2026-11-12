export const chess = {
  /** Lowercase for API paths and comparisons. */
  username: "darthcracker",
  displayName: "DarthCracker",
  timeClass: "rapid" as const,
  goalRating: 1200,
  /** Month of return; startRating, peak and record count from here. */
  trackSince: "2026-11",
  /** Backfill and the low/history start here. */
  backfillSince: "2026-10",
};

export type ChessConfig = typeof chess;

export const chessProfileUrl = `https://www.chess.com/member/${chess.username}`;
