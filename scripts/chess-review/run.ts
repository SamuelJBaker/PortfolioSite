// Local move review: reads unreviewed rapid games from D1, analyses them with
// a Stockfish on PATH, classifies every move, and writes chess_reviews rows.
// Stockfish never runs in the Worker; this script runs on James's machine.
//
// usage: npm run chess:review -- [--depth 14] [--limit N] [--since YYYY-MM]
//        [--game <url>] [--force] [--local] [--dry-run]

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLASSES, type MoveClass } from "../../src/lib/chess/classify.ts";
import { reviewGame } from "./review.ts";
import { StockfishEngine } from "./uci.ts";

const DB = "samueljbaker-analytics";
const bookPath = fileURLToPath(new URL("./book.json", import.meta.url));

interface Flags {
  depth: number;
  limit: number | null;
  since: string | null;
  game: string | null;
  force: boolean;
  local: boolean;
  dryRun: boolean;
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = { depth: 14, limit: null, since: null, game: null, force: false, local: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--depth") f.depth = Number(next());
    else if (a === "--limit") f.limit = Number(next());
    else if (a === "--since") f.since = next();
    else if (a === "--game") f.game = next();
    else if (a === "--force") f.force = true;
    else if (a === "--local") f.local = true;
    else if (a === "--dry-run") f.dryRun = true;
    else throw new Error(`unknown flag ${a}`);
  }
  if (!Number.isInteger(f.depth) || f.depth < 1) throw new Error("--depth must be a positive integer");
  if (f.since && !/^\d{4}-(0[1-9]|1[0-2])$/.test(f.since)) throw new Error("--since must be YYYY-MM");
  return f;
}

function sql(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

interface GameRow {
  game_url: string;
  pgn: string;
  my_color: "white" | "black";
  end_time: number;
}

/** Everything wrangler printed, minus npm's own "notice" chatter, for error messages. */
function wranglerOutput(res: { stdout: string; stderr: string }): string {
  return [res.stdout, res.stderr]
    .join("\n")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("npm notice"))
    .join("\n")
    .trim();
}

function d1(args: string[], local: boolean, attempt = 1): unknown {
  const res = spawnSync("npx", ["wrangler", "d1", "execute", DB, local ? "--local" : "--remote", "--json", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? "bd8d9defd26c2c8507d72592756dca5c" },
  });
  const start = res.stdout.indexOf("[");
  if (res.status !== 0 || start === -1) {
    // The Cloudflare API returns the odd transient error (a 7403 was seen once); one retry for remote.
    if (!local && attempt === 1) {
      console.log("wrangler d1 execute failed once, retrying in 3 s...");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
      return d1(args, local, 2);
    }
    throw new Error(`wrangler d1 execute failed (exit ${res.status}):\n${wranglerOutput(res) || "(no output)"}`);
  }
  return JSON.parse(res.stdout.slice(start));
}

function loadGames(f: Flags): GameRow[] {
  const where = [
    "g.time_class = 'rapid'",
    "g.pgn IS NOT NULL",
    f.force ? null : "r.game_url IS NULL",
    f.since ? `g.end_time >= ${Date.UTC(Number(f.since.slice(0, 4)), Number(f.since.slice(5)) - 1, 1) / 1000}` : null,
    f.game ? `g.game_url = ${sql(f.game)}` : null,
  ]
    .filter(Boolean)
    .join(" AND ");
  const query =
    `SELECT g.game_url, g.pgn, g.my_color, g.end_time FROM chess_games g ` +
    `LEFT JOIN chess_reviews r ON r.game_url = g.game_url WHERE ${where} ORDER BY g.end_time DESC` +
    (f.limit ? ` LIMIT ${f.limit}` : "");
  const out = d1(["--command", query], f.local) as { results?: GameRow[] }[];
  return out[0]?.results ?? [];
}

function countsLine(counts: Partial<Record<MoveClass, number>>): string {
  return CLASSES.filter((c) => counts[c]).map((c) => `${c} ${counts[c]}`).join(", ") || "none";
}

function fmt(n: number | null): string {
  return n === null ? "--" : n.toFixed(1);
}

async function main() {
  const f = parseFlags(process.argv.slice(2));

  if (!existsSync(bookPath)) {
    console.error("book.json is missing: run `npm run chess:review:book` first.");
    process.exit(1);
  }
  const book: ReadonlySet<string> = new Set(JSON.parse(readFileSync(bookPath, "utf8")) as string[]);

  let engine: StockfishEngine;
  try {
    engine = await StockfishEngine.start("stockfish");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    console.error(
      code === "ENOENT"
        ? "stockfish was not found on PATH. Install it (e.g. `sudo pacman -S stockfish` or https://stockfishchess.org/download/) and retry."
        : `could not start stockfish: ${err instanceof Error ? err.message : err}`
    );
    process.exit(1);
  }
  console.log(`engine: ${engine.name}, depth ${f.depth}, MultiPV 2${f.dryRun ? ", dry run" : ""}${f.local ? ", local D1" : ", remote D1"}`);

  const games = loadGames(f);
  console.log(`games to review: ${games.length}`);
  const started = Date.now();
  const statements: string[] = [];
  let reviewed = 0;

  for (const g of games) {
    const t0 = Date.now();
    const myColor = g.my_color === "white" ? "w" : "b";
    let r;
    try {
      r = await reviewGame(g.pgn, myColor, engine, book, f.depth);
    } catch (err) {
      console.log(`${g.game_url}: skipped (${err instanceof Error ? err.message : err})`);
      continue;
    }
    reviewed++;
    console.log(
      `${g.game_url}: ${r.plies} plies, acc me ${fmt(r.accMe)} opp ${fmt(r.accOpp)}, ${((Date.now() - t0) / 1000).toFixed(1)} s`
    );
    console.log(`  me:  ${countsLine(r.countsMe)}`);
    console.log(`  opp: ${countsLine(r.countsOpp)}`);
    if (f.dryRun && f.game) {
      for (const d of r.detail) {
        console.log(`  ${String(d.ply).padStart(3)} ${d.mover} ${d.san.padEnd(7)} ${d.cls.padEnd(10)} loss ${d.loss.toFixed(3)} acc ${d.accuracy.toFixed(1)} best ${d.bestCp} played ${d.playedCp}`);
      }
    }
    statements.push(
      `INSERT OR REPLACE INTO chess_reviews (game_url, engine, depth, acc_me, acc_opp, counts_me, counts_opp, moves, reviewed_at) VALUES (` +
        [
          sql(g.game_url),
          sql(engine.name),
          f.depth,
          r.accMe === null ? null : Math.round(r.accMe * 10) / 10,
          r.accOpp === null ? null : Math.round(r.accOpp * 10) / 10,
          sql(JSON.stringify(r.countsMe)),
          sql(JSON.stringify(r.countsOpp)),
          sql(JSON.stringify(r.moves)),
          Math.floor(Date.now() / 1000),
        ].join(", ") +
        ");"
    );
  }
  engine.quit();

  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  if (f.dryRun) {
    console.log(`dry run: ${reviewed} game(s) reviewed, nothing written, ${elapsed} s`);
    return;
  }
  if (statements.length === 0) {
    console.log(`nothing to write, ${elapsed} s`);
    return;
  }
  const file = join(mkdtempSync(join(tmpdir(), "chess-review-")), "reviews.sql");
  writeFileSync(file, statements.join("\n") + "\n");
  d1(["--file", file], f.local);
  console.log(`wrote ${statements.length} review(s) to ${f.local ? "local" : "remote"} D1 (${file}), ${elapsed} s`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
