// Builds the openings set for the move review: every position reached by
// every line of the lichess-org/chess-openings dataset (CC0 1.0; see
// docs/phase-6c/LICENSES.md), as sorted position keys (the first four FEN
// fields). Output: scripts/chess-review/book.json, read only by run.ts.
// Never imported from src/.
//
// usage: npm run chess:review:book   (downloads the five TSVs once into ./data)

import { Chess } from "chess.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "https://raw.githubusercontent.com/lichess-org/chess-openings/master/";
const FILES = ["a", "b", "c", "d", "e"];
const USER_AGENT = "samueljbaker.dev (contact: samuel.j.baker908@gmail.com)";
const dataDir = fileURLToPath(new URL("./data/", import.meta.url));
const outPath = fileURLToPath(new URL("./book.json", import.meta.url));

/** The first four FEN fields: placement, side to move, castling, en passant. */
export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

async function loadTsv(name: string): Promise<string> {
  const local = `${dataDir}${name}.tsv`;
  if (existsSync(local)) return readFileSync(local, "utf8");
  const res = await fetch(`${BASE}${name}.tsv`, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${name}.tsv: HTTP ${res.status}`);
  const text = await res.text();
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(local, text);
  return text;
}

async function main() {
  const keys = new Set<string>();
  let lines = 0;
  let skipped = 0;
  for (const name of FILES) {
    const text = await loadTsv(name);
    for (const row of text.split("\n").slice(1)) {
      if (!row.trim()) continue;
      const [, , pgn] = row.split("\t");
      if (!pgn) continue;
      lines++;
      const game = new Chess();
      try {
        game.loadPgn(pgn);
      } catch {
        skipped++;
        continue;
      }
      for (const move of game.history({ verbose: true })) keys.add(positionKey(move.after));
    }
  }
  const sorted = [...keys].sort();
  writeFileSync(outPath, JSON.stringify(sorted));
  console.log(`book: ${lines} lines, ${skipped} skipped, ${sorted.length} positions -> ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
