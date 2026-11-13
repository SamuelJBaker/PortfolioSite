import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ecoUrlFromPgn,
  mapArchive,
  mapArchiveGame,
  openingFamily,
  openingNameFromEcoUrl,
  plyCount,
  terminationFrom,
  type ArchiveGame,
  type ArchiveResponse,
} from "./ingest";

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

describe("derived fields", () => {
  const pgn =
    '[Event "Live Chess"]\n[ECO "B01"]\n[ECOUrl "https://www.chess.com/openings/Scandinavian-Defense-2.exd5-e5"]\n[TimeControl "600"]\n\n' +
    "1. e4 {[%clk 0:09:56.4]} 1... d5 {[%clk 0:09:56.6]} 2. exd5 {[%clk 0:09:54.2]} 2... e5 {[%clk 0:09:53.8]} 3. Nf3 {[%clk 0:09:52.1]} 1-0";

  it("maps terminations from the loser's code", () => {
    expect(terminationFrom("win", "checkmated")).toBe("checkmate");
    expect(terminationFrom("win", "resigned")).toBe("resign");
    expect(terminationFrom("timeout", "win")).toBe("timeout");
    expect(terminationFrom("abandoned", "win")).toBe("abandoned");
    expect(terminationFrom("stalemate", "stalemate")).toBe("stalemate");
    expect(terminationFrom("repetition", "repetition")).toBe("repetition");
    expect(terminationFrom("agreed", "agreed")).toBe("agreed");
    expect(terminationFrom("insufficient", "insufficient")).toBe("insufficient");
    expect(terminationFrom("timevsinsufficient", "timevsinsufficient")).toBe("insufficient");
    expect(terminationFrom("50move", "50move")).toBe("other");
    expect(terminationFrom("win", null)).toBe("other");
  });

  it("derives the opening family", () => {
    expect(openingFamily("Alekhines Defense Maroczy Variation")).toBe("Alekhines Defense");
    expect(openingFamily("Kings Pawn Opening Latvian Gambit Accepted")).toBe("Kings Pawn Opening Latvian Gambit");
    expect(openingFamily("Queens Pawn Opening Zukertort Chigorin Variation")).toBe("Queens Pawn Opening Zukertort Chigorin Variation");
    expect(openingFamily("Englund Gambit")).toBe("Englund Gambit");
    expect(openingFamily("Reti Opening")).toBe("Reti Opening");
    expect(openingFamily(null)).toBeNull();
  });

  it("counts plies without clocks, move numbers or the result", () => {
    expect(plyCount(pgn)).toBe(5);
    expect(plyCount(undefined)).toBeNull();
    expect(plyCount('[Event "x"]\n\n1. e4 e5 2. Nf3 Nc6 1/2-1/2')).toBe(4);
  });

  it("stores eco, family, ply count, time control, accuracies and the pgn", () => {
    const row = mapArchiveGame(
      { ...base, pgn, time_control: "600", accuracies: { white: 61.2, black: 70.5 } },
      "darthcracker",
      "rapid"
    )!;
    expect(row).toMatchObject({
      opp_result: "resigned",
      termination: "resign",
      eco: "B01",
      opening_family: "Scandinavian Defense",
      ply_count: 5,
      time_control: "600",
      cc_accuracy_me: 70.5,
      cc_accuracy_opp: 61.2,
      pgn,
    });
    const bare = mapArchiveGame(base, "darthcracker", "rapid")!;
    expect(bare).toMatchObject({ eco: null, ply_count: null, time_control: null, cc_accuracy_me: null, cc_accuracy_opp: null, pgn: null });
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

  it("derives fields on every fixture row", () => {
    expect(rows.every((r) => r.pgn && r.ply_count && r.ply_count > 0 && r.time_control === "600")).toBe(true);
    expect(rows.every((r) => r.termination !== "other")).toBe(true);
    expect(rows.filter((r) => r.cc_accuracy_me !== null)).toHaveLength(43);
    expect(rows.every((r) => !r.eco_url || (r.eco && r.opening_family))).toBe(true);
    const terms: Record<string, number> = {};
    for (const r of rows) terms[r.termination!] = (terms[r.termination!] ?? 0) + 1;
    // Loser codes over the 115 rows, checked against the raw fixture by hand.
    expect(terms).toEqual({ checkmate: 53, resign: 37, timeout: 17, abandoned: 3, insufficient: 2, stalemate: 2, repetition: 1 });
  });

  it("has an opening name for every row with an eco url and unique urls", () => {
    expect(rows.filter((r) => r.eco_url && !r.opening_name)).toHaveLength(0);
    expect(new Set(rows.map((r) => r.game_url)).size).toBe(rows.length);
    expect(Math.min(...rows.map((r) => r.my_rating))).toBe(478);
  });
});
