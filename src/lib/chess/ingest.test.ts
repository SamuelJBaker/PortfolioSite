import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ecoUrlFromPgn, mapArchive, mapArchiveGame, openingNameFromEcoUrl, type ArchiveGame, type ArchiveResponse } from "./ingest";

const fixture = JSON.parse(readFileSync(new URL("../../../fixtures/chess-archive.json", import.meta.url), "utf8")) as ArchiveResponse;

const base: ArchiveGame = {
  url: "https://www.chess.com/game/live/1",
  end_time: 1_793_000_000,
  rated: true,
  rules: "chess",
  time_class: "rapid",
  fen: "8/8/8/8/8/8/8/8 w - - 0 1",
  eco: "https://www.chess.com/openings/Scandinavian-Defense-2.exd5-e5",
  white: { username: "Other", rating: 600, result: "resigned" },
  black: { username: "DarthCracker", rating: 610, result: "win" },
};

describe("openingNameFromEcoUrl", () => {
  it("swaps hyphens and cuts at the first move token", () => {
    expect(openingNameFromEcoUrl("https://www.chess.com/openings/Scandinavian-Defense-2.exd5-e5")).toBe("Scandinavian Defense");
    expect(openingNameFromEcoUrl("https://www.chess.com/openings/Alekhines-Defense-Maroczy-Variation-2...d5")).toBe(
      "Alekhines Defense Maroczy Variation"
    );
    expect(openingNameFromEcoUrl("https://www.chess.com/openings/Kings-Indian-Defense-Normal-Variation-4.e4-d6-5.Nf3-O-O")).toBe(
      "Kings Indian Defense Normal Variation"
    );
    expect(openingNameFromEcoUrl("https://www.chess.com/openings/Englund-Gambit")).toBe("Englund Gambit");
  });
  it("returns null without a slug", () => {
    expect(openingNameFromEcoUrl(null)).toBeNull();
    expect(openingNameFromEcoUrl("https://www.chess.com/other")).toBeNull();
  });
});

describe("mapArchiveGame", () => {
  it("maps my side, outcome and opening", () => {
    const row = mapArchiveGame(base, "darthcracker", "rapid");
    expect(row).toMatchObject({
      game_url: base.url,
      end_time: base.end_time,
      my_color: "black",
      my_rating: 610,
      my_result: "win",
      outcome: "W",
      opp_username: "Other",
      opp_rating: 600,
      eco_url: base.eco,
      opening_name: "Scandinavian Defense",
      final_fen: base.fen,
      last_move_from: null,
      last_move_to: null,
    });
  });

  it("filters by rules, time class and rated", () => {
    expect(mapArchiveGame({ ...base, rules: "chess960" }, "darthcracker", "rapid")).toBeNull();
    expect(mapArchiveGame({ ...base, time_class: "blitz" }, "darthcracker", "rapid")).toBeNull();
    expect(mapArchiveGame({ ...base, rated: false }, "darthcracker", "rapid")).toBeNull();
    expect(mapArchiveGame(base, "someoneelse", "rapid")).toBeNull();
  });

  it("maps draw codes to D and everything else to L", () => {
    for (const code of ["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]) {
      expect(mapArchiveGame({ ...base, black: { ...base.black, result: code } }, "darthcracker", "rapid")?.outcome).toBe("D");
    }
    for (const code of ["checkmated", "resigned", "timeout", "abandoned", "lose"]) {
      expect(mapArchiveGame({ ...base, black: { ...base.black, result: code } }, "darthcracker", "rapid")?.outcome).toBe("L");
    }
  });

  it("falls back to the PGN ECOUrl header, then null", () => {
    const pgn = '[Event "Live Chess"]\n[ECOUrl "https://www.chess.com/openings/Englund-Gambit"]\n\n1. d4 e5';
    expect(ecoUrlFromPgn(pgn)).toBe("https://www.chess.com/openings/Englund-Gambit");
    const row = mapArchiveGame({ ...base, eco: undefined, pgn }, "darthcracker", "rapid");
    expect(row?.opening_name).toBe("Englund Gambit");
    const none = mapArchiveGame({ ...base, eco: undefined, pgn: "[Event \"x\"]" }, "darthcracker", "rapid");
    expect(none?.eco_url).toBeNull();
    expect(none?.opening_name).toBeNull();
  });
});

describe("fixture archive (2026/10)", () => {
  const rows = mapArchive(fixture, "darthcracker", "rapid");

  it("keeps the 115 rated rapid games and drops the 31 daily ones", () => {
    expect(fixture.games).toHaveLength(146);
    expect(rows).toHaveLength(115);
    expect(rows.every((r) => r.time_class === "rapid")).toBe(true);
  });

  it("maps outcomes to the known W/L/D split", () => {
    const count = { W: 0, L: 0, D: 0 };
    for (const r of rows) count[r.outcome]++;
    expect(count).toEqual({ W: 55, L: 55, D: 5 });
  });

  it("has an opening name for every row with an eco url and unique urls", () => {
    expect(rows.filter((r) => r.eco_url && !r.opening_name)).toHaveLength(0);
    expect(new Set(rows.map((r) => r.game_url)).size).toBe(rows.length);
    expect(Math.min(...rows.map((r) => r.my_rating))).toBe(478);
  });
});
