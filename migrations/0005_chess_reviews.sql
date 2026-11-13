-- Move review results from the local Stockfish script (scripts/chess-review).
-- Our own analysis; chess.com's accuracy stays in chess_games.cc_accuracy_*.
-- Keyed on game_url like chess_games (the prompt's game_id).
CREATE TABLE IF NOT EXISTS chess_reviews (
  game_url    TEXT PRIMARY KEY REFERENCES chess_games(game_url),
  engine      TEXT NOT NULL,       -- e.g. "Stockfish 19"
  depth       INTEGER NOT NULL,
  acc_me      REAL,                -- mean move accuracy, book moves excluded
  acc_opp     REAL,
  counts_me   TEXT NOT NULL,       -- JSON: class -> count
  counts_opp  TEXT NOT NULL,
  moves       TEXT NOT NULL,       -- JSON array per ply: { c: class, e: cp from white's view, m: mate distance or null }
  reviewed_at INTEGER NOT NULL     -- unix seconds
);
