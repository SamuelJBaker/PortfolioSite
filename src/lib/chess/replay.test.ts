import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ArchiveResponse } from "./ingest";
import { replayFromPgn } from "./replay";

const fixture = JSON.parse(readFileSync(new URL("../../../fixtures/chess-archive.json", import.meta.url), "utf8")) as ArchiveResponse;

describe("replayFromPgn", () => {
  it("replays a short PGN with clock comments", () => {
    const pgn = '[Event "x"]\n\n1. e4 {[%clk 0:09:56.4]} 1... e5 {[%clk 0:09:56.6]} 2. Nf3 {[%clk 0:09:54.2]} 1-0';
    const r = replayFromPgn(pgn)!;
    expect(r.sans).toEqual(["e4", "e5", "Nf3"]);
    expect(r.lastMoves).toEqual([["e2", "e4"], ["e7", "e5"], ["g1", "f3"]]);
    expect(r.fens).toHaveLength(4);
    expect(r.fens[0]).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(r.fens[3].split(" ")[0]).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R");
  });

  it("returns null for missing or broken input", () => {
    expect(replayFromPgn(null)).toBeNull();
    expect(replayFromPgn("")).toBeNull();
    expect(replayFromPgn("not a pgn at all 9. Zz9")).toBeNull();
  });

  it("replays every rated fixture game to its archived final position", () => {
    const games = (fixture.games ?? []).filter((g) => g.time_class === "rapid" && g.rated);
    let ok = 0;
    for (const g of games) {
      const r = replayFromPgn(g.pgn);
      if (r && r.fens[r.fens.length - 1].split(" ")[0] === g.fen!.split(" ")[0]) ok++;
    }
    expect(ok).toBe(games.length);
  });
});
