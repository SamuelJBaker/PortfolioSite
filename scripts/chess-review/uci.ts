// Minimal UCI driver for the local review: one engine process, reused for
// every position. Scores come back from the side to move's point of view.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export interface EngineLine {
  /** 1-based MultiPV rank. */
  multipv: number;
  /** Centipawns from the side to move, when not a mate score. */
  cp: number | null;
  /** Mate in n from the side to move (negative: getting mated), when a mate score. */
  mate: number | null;
  /** Principal variation in UCI long algebraic ("e2e4"). */
  pv: string[];
}

export interface Analysis {
  lines: EngineLine[];
  /** UCI best move, or null when the position has no legal moves. */
  bestmove: string | null;
}

export interface Engine {
  analyze(fen: string, depth: number): Promise<Analysis>;
}

/** Parses one "info ..." line; null when it carries no score or pv. */
export function parseInfo(line: string): EngineLine | null {
  if (!line.startsWith("info ")) return null;
  const tokens = line.split(/\s+/);
  let multipv = 1;
  let cp: number | null = null;
  let mate: number | null = null;
  let pv: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "multipv") multipv = Number(tokens[++i]);
    else if (t === "score") {
      const kind = tokens[++i];
      const value = Number(tokens[++i]);
      if (kind === "cp") cp = value;
      else if (kind === "mate") mate = value;
    } else if (t === "pv") {
      pv = tokens.slice(i + 1);
      break;
    }
  }
  if (cp === null && mate === null) return null;
  return { multipv, cp, mate, pv };
}

export class StockfishEngine implements Engine {
  private proc: ChildProcessWithoutNullStreams;
  private buffer = "";
  private waiters: ((line: string) => void)[] = [];
  readonly name: string;

  private constructor(proc: ChildProcessWithoutNullStreams, name: string) {
    this.proc = proc;
    this.name = name;
    proc.stdout.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      let idx: number;
      while ((idx = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, idx).trimEnd();
        this.buffer = this.buffer.slice(idx + 1);
        for (const w of this.waiters.splice(0)) w(line);
      }
    });
  }

  /** Spawns `command` (default "stockfish" on PATH) and completes the UCI handshake. */
  static async start(command = "stockfish", multipv = 2, threads = 1): Promise<StockfishEngine> {
    const proc = spawn(command, [], { stdio: ["pipe", "pipe", "pipe"] });
    await new Promise<void>((resolve, reject) => {
      proc.once("spawn", () => resolve());
      proc.once("error", (err) => reject(err));
    });
    const banner = await new Promise<string>((resolve) => {
      let first = "";
      const onData = (chunk: Buffer) => {
        const text = chunk.toString();
        if (!first) first = text.split("\n")[0].trim();
        if (text.includes("uciok")) {
          proc.stdout.off("data", onData);
          resolve(first);
        }
      };
      proc.stdout.on("data", onData);
      proc.stdin.write("uci\n");
    });
    const engine = new StockfishEngine(proc, banner.replace(/ by .*$/, ""));
    engine.send(`setoption name MultiPV value ${multipv}`);
    engine.send(`setoption name Threads value ${threads}`);
    engine.send("ucinewgame");
    await engine.ready();
    return engine;
  }

  private send(cmd: string) {
    this.proc.stdin.write(cmd + "\n");
  }

  private nextLine(): Promise<string> {
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private async ready() {
    this.send("isready");
    for (;;) if ((await this.nextLine()) === "readyok") return;
  }

  async analyze(fen: string, depth: number): Promise<Analysis> {
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    const byRank = new Map<number, EngineLine>();
    for (;;) {
      const line = await this.nextLine();
      if (line.startsWith("bestmove")) {
        const move = line.split(/\s+/)[1];
        const lines = [...byRank.values()].sort((a, b) => a.multipv - b.multipv);
        return { lines, bestmove: move && move !== "(none)" ? move : null };
      }
      const info = parseInfo(line);
      // Later lines at the same rank supersede earlier (shallower) ones.
      if (info) byRank.set(info.multipv, info);
    }
  }

  quit() {
    this.send("quit");
    this.proc.stdin.end();
  }
}
