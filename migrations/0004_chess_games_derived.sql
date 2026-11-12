-- Derived per-game fields for the chess card v2 (phase 6b). All nullable so
-- rows stored by phase 6 stay valid; a backfill re-run fills them from the
-- archives (ON CONFLICT DO UPDATE in src/lib/chess/refresh.ts).
ALTER TABLE chess_games ADD COLUMN opp_result TEXT;        -- raw chess.com result code, opponent side
ALTER TABLE chess_games ADD COLUMN termination TEXT;       -- checkmate|resign|timeout|abandoned|stalemate|repetition|agreed|insufficient|other
ALTER TABLE chess_games ADD COLUMN eco TEXT;               -- PGN ECO tag, e.g. B00
ALTER TABLE chess_games ADD COLUMN opening_family TEXT;    -- opening_name up to the first Variation/Defense/Attack/Gambit/System
ALTER TABLE chess_games ADD COLUMN ply_count INTEGER;      -- half-moves in the PGN movetext
ALTER TABLE chess_games ADD COLUMN time_control TEXT;      -- e.g. 600 or 600+5
ALTER TABLE chess_games ADD COLUMN cc_accuracy_me REAL;    -- chess.com Game Review accuracy, my side, when present
ALTER TABLE chess_games ADD COLUMN cc_accuracy_opp REAL;
ALTER TABLE chess_games ADD COLUMN pgn TEXT;               -- full PGN with clocks; phase 6c reads it
