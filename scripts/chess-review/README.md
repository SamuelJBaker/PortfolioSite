# Chess move review (local)

Computes per-move classes and accuracy for the stored rapid games with a
local Stockfish and writes the results to the `chess_reviews` table. The
site reads that table through `/api/chess`; nothing here ships to the
browser or the Worker. The labels are our own analysis, not chess.com's.

## Install

- Node 22.18 or newer (the scripts are TypeScript run directly by node).
- Stockfish on PATH. Arch: `sudo pacman -S stockfish`. Others:
  https://stockfishchess.org/download/ (extract and put the binary on PATH
  as `stockfish`).
- Wrangler logged in (`npx wrangler whoami`); `CLOUDFLARE_ACCOUNT_ID` is
  set by the script to the site's account when unset.

## Run order

1. `npm run chess:review:book` once. Downloads the lichess
   chess-openings TSVs (CC0) into `scripts/chess-review/data/` and writes
   `book.json` (about 8,000 positions). Both are gitignored. Re-run to pick
   up dataset updates.
2. `npm run chess:review` reviews every stored rapid game that has a PGN
   and no review yet, newest first, and writes the rows to remote D1.

Flags (after `--`):

| Flag | Meaning |
|---|---|
| `--depth N` | search depth per position, default 14 |
| `--limit N` | at most N games |
| `--since YYYY-MM` | games from that month on |
| `--game <url>` | one game by its chess.com URL; with `--dry-run` prints every move |
| `--force` | re-review games that already have a row |
| `--local` | read and write the local D1 (`.wrangler/state`) instead of remote |
| `--dry-run` | analyse and print, write nothing |

Examples:

    npm run chess:review -- --limit 5 --dry-run --local
    npm run chess:review -- --game https://www.chess.com/game/live/187020762684 --dry-run --force
    npm run chess:review -- --since 2026-11

## Output

Per game: URL, plies, accuracy for both sides, class counts for both
sides, seconds taken. At the end: games reviewed, where the SQL went,
elapsed time. Rows are `INSERT OR REPLACE`, so re-running with `--force`
replaces earlier reviews (for a higher depth, say).

## Expected runtime

Depth 14 with MultiPV 2 on one thread costs roughly 0.2 to 0.5 s per
position on a recent laptop, so a typical 80-ply rapid game takes 20 to 40
s and 200 games take one to two hours. Leave it running; the engine process
is reused across games. `--depth 18` roughly triples the time.

## How the labels are computed

`src/lib/chess/classify.ts` (shared with the site for the class list and
tests): win percent from centipawns, expected-points loss against the
engine's top line, base class by loss, then the book / brilliant / great /
miss overrides, and the per-move accuracy curve. `review.ts` builds the
inputs from chess.js and the engine lines; `uci.ts` talks to the engine.
