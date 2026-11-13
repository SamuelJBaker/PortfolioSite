import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { applyUci, lineCp, materialBalance, positionKey, reviewGame } from "./review.ts";
import { LineQueue, parseInfo, type Analysis, type Engine } from "./uci.ts";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Fake engine: equal evaluation everywhere, best move = first legal move in SAN order, second line slightly worse. */
function flatEngine(): Engine & { calls: number } {
  return {
    calls: 0,
    async analyze(fen: string): Promise<Analysis> {
      this.calls++;
      const game = new Chess(fen);
      const moves = game.moves({ verbose: true });
      if (moves.length === 0) return { lines: [], bestmove: null };
      const uci = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? "");
      return {
        lines: [
          { multipv: 1, cp: 0, mate: null, pv: [uci(moves[0])] },
          ...(moves[1] ? [{ multipv: 2, cp: -10, mate: null, pv: [uci(moves[1])] }] : []),
        ],
        bestmove: uci(moves[0]),
      };
    },
  };
}

describe("parseInfo", () => {
  it("reads multipv, cp or mate, and the pv", () => {
    expect(parseInfo("info depth 14 seldepth 20 multipv 2 score cp -35 nodes 1 pv e7e5 g1f3")).toEqual({ multipv: 2, cp: -35, mate: null, pv: ["e7e5", "g1f3"] });
    expect(parseInfo("info depth 14 multipv 1 score mate 3 pv d1h5")).toEqual({ multipv: 1, cp: null, mate: 3, pv: ["d1h5"] });
    expect(parseInfo("info depth 1 score cp 20 pv e2e4")?.multipv).toBe(1);
    expect(parseInfo("info string NNUE evaluation using nn.nnue")).toBeNull();
    expect(parseInfo("bestmove e2e4")).toBeNull();
  });
});

describe("LineQueue", () => {
  it("delivers every line of a multi-line chunk, in order, across awaits", async () => {
    const q = new LineQueue();
    q.push("info depth 1 score cp 5 pv e2e4\ninfo depth 2 score cp 7 pv e2e4\nbestmove e2e4\n");
    expect(await q.next()).toBe("info depth 1 score cp 5 pv e2e4");
    expect(await q.next()).toBe("info depth 2 score cp 7 pv e2e4");
    expect(await q.next()).toBe("bestmove e2e4");
  });
  it("waits for a line that has not arrived and joins split chunks", async () => {
    const q = new LineQueue();
    const pending = q.next();
    q.push("ready");
    q.push("ok\nbestmove (none)\n");
    expect(await pending).toBe("readyok");
    expect(await q.next()).toBe("bestmove (none)");
  });
});

describe("helpers", () => {
  it("keys the first four FEN fields", () => {
    expect(positionKey(START)).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -");
  });
  it("counts material with and without pawns", () => {
    expect(materialBalance(START, "w")).toBe(0);
    const upAKnight = "rnbqkb1r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(materialBalance(upAKnight, "w")).toBe(3);
    expect(materialBalance(upAKnight, "b")).toBe(-3);
    const upAPawn = "rnbqkbnr/ppppppp1/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(materialBalance(upAPawn, "w")).toBe(1);
    expect(materialBalance(upAPawn, "w", false)).toBe(0);
  });
  it("maps engine lines to the clamped scale", () => {
    expect(lineCp({ multipv: 1, cp: 2500, mate: null, pv: [] })).toBe(1000);
    expect(lineCp({ multipv: 1, cp: null, mate: -2, pv: [] })).toBe(-1000);
    expect(lineCp(undefined)).toBeNull();
  });
  it("applies UCI moves", () => {
    expect(applyUci(START, "e2e4")?.split(" ")[0]).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR");
    expect(applyUci(START, "e2e5")).toBeNull();
  });
});

describe("reviewGame", () => {
  const pgn = '[Event "t"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1/2-1/2';

  it("analyses every position once and classifies each ply", async () => {
    const engine = flatEngine();
    const book = new Set<string>([positionKey(applyUci(START, "e2e4")!)]);
    const r = await reviewGame(pgn, "w", engine, book, 1);
    expect(engine.calls).toBe(7);
    expect(r.plies).toBe(6);
    expect(r.moves).toHaveLength(6);
    expect(r.moves[0].c).toBe("book");
    expect(r.moves.every((m) => m.e === 0 && m.m === null)).toBe(true);
    // Flat evaluations: every non-book move loses nothing, so it is excellent,
    // or best when the played move happens to be the fake engine's first legal move.
    expect(r.moves.slice(1).every((m) => m.c === "excellent" || m.c === "best")).toBe(true);
    expect(r.accMe).toBeCloseTo(100, 3);
    expect(r.accOpp).toBeCloseTo(100, 3);
    expect(r.countsMe.book).toBe(1);
    expect(Object.values(r.countsMe).reduce((a, b) => a + b, 0)).toBe(3);
    expect(Object.values(r.countsOpp).reduce((a, b) => a + b, 0)).toBe(3);
    expect(r.detail[0]).toMatchObject({ ply: 1, san: "e4", mover: "w", cls: "book" });
  });

  it("is null-accurate for a book-only game and swaps sides for black", async () => {
    const engine = flatEngine();
    const game = new Chess();
    game.loadPgn(pgn);
    const book = new Set(game.history({ verbose: true }).map((m) => positionKey(m.after)));
    const r = await reviewGame(pgn, "b", engine, book, 1);
    expect(r.accMe).toBeNull();
    expect(r.accOpp).toBeNull();
    expect(r.countsMe).toEqual({ book: 3 });
  });

  it("marks a mate delivered and a blunder that allows mate", async () => {
    // Fool's mate: 1. f3 e5 2. g4 Qh4#
    const mateEngine: Engine = {
      async analyze(fen: string): Promise<Analysis> {
        const game = new Chess(fen);
        if (game.isCheckmate()) return { lines: [], bestmove: null };
        const moves = game.moves({ verbose: true });
        const mateIn1 = moves.find((m) => m.san.endsWith("#"));
        const uci = (m: { from: string; to: string }) => m.from + m.to;
        if (mateIn1) return { lines: [{ multipv: 1, cp: null, mate: 1, pv: [uci(mateIn1)] }], bestmove: uci(mateIn1) };
        return { lines: [{ multipv: 1, cp: 0, mate: null, pv: [uci(moves[0])] }], bestmove: uci(moves[0]) };
      },
    };
    const r = await reviewGame('[Event "t"]\n\n1. f3 e5 2. g4 Qh4# 0-1', "w", mateEngine, new Set(), 1);
    expect(r.moves[2].c).toBe("blunder"); // 2. g4 allows mate in one
    expect(r.moves[3].c).toBe("best"); // Qh4# is the engine's move
    expect(r.moves[3].e).toBe(-1000);
    expect(r.moves[2].m).toBe(-1); // after g4, black mates in one: from white's view -1
    expect(r.countsOpp.best).toBe(1);
  });
});
