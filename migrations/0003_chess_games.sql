-- Rated games for the chess card, ingested from the chess.com monthly archives.
-- game_url is the natural key; INSERT OR IGNORE makes re-ingest safe.
CREATE TABLE IF NOT EXISTS chess_games (
  game_url       TEXT PRIMARY KEY,
  end_time       INTEGER NOT NULL,   -- unix seconds
  time_class     TEXT NOT NULL,
  my_color       TEXT NOT NULL CHECK (my_color IN ('white','black')),
  my_rating      INTEGER NOT NULL,   -- rating after the game
  my_result      TEXT NOT NULL,      -- raw chess.com result code
  outcome        TEXT NOT NULL CHECK (outcome IN ('W','L','D')),
  opp_username   TEXT NOT NULL,
  opp_rating     INTEGER NOT NULL,
  eco_url        TEXT,
  opening_name   TEXT,
  final_fen      TEXT NOT NULL,
  last_move_from TEXT,               -- optional, e.g. 'e2'; unused (no PGN parsing)
  last_move_to   TEXT
);
CREATE INDEX IF NOT EXISTS idx_chess_games_end
  ON chess_games (time_class, end_time);
