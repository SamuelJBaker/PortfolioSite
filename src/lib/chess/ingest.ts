import type { ChessColor, ChessGameRow, ChessOutcome, ChessTermination } from "./types";

/** The fields of a chess.com monthly-archive game this mapper reads. */
export interface ArchiveSide {
  username?: string;
  rating?: number;
  result?: string;
}

export interface ArchiveGame {
  url?: string;
  end_time?: number;
  rated?: boolean;
  rules?: string;
  time_class?: string;
  time_control?: string;
  fen?: string;
  eco?: string;
  pgn?: string;
  /** Present only on games that had a chess.com Game Review. */
  accuracies?: { white?: number; black?: number };
  white?: ArchiveSide;
  black?: ArchiveSide;
}

export interface ArchiveResponse {
  games?: ArchiveGame[];
}

const DRAW_CODES = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);

export function outcomeFromResult(result: string): ChessOutcome {
  if (result === "win") return "W";
  if (DRAW_CODES.has(result)) return "D";
  return "L";
}

/**
 * Opening name from a chess.com eco URL: the slug after /openings/, hyphens
 * swapped for spaces, cut at the first move token ("3.exd5", "2...d5"), so
 * ".../Scandinavian-Defense-2.exd5-e5" becomes "Scandinavian Defense".
 */
export function openingNameFromEcoUrl(ecoUrl: string | null | undefined): string | null {
  if (!ecoUrl) return null;
  const idx = ecoUrl.indexOf("/openings/");
  if (idx === -1) return null;
  const slug = ecoUrl.slice(idx + "/openings/".length).split(/[?#]/)[0];
  const words: string[] = [];
  for (const token of slug.split("-")) {
    if (/^\d+\.{1,3}/.test(token)) break;
    if (token) words.push(token);
  }
  return words.length ? words.join(" ") : null;
}

/**
 * How the game ended, from the two raw result codes. The loser's code names
 * the mechanism ("checkmated", "resigned", "timeout", "abandoned"); draws
 * carry the same code on both sides.
 */
export function terminationFrom(myResult: string, oppResult: string | null): ChessTermination {
  const loser = myResult === "win" ? (oppResult ?? "") : myResult;
  switch (loser) {
    case "checkmated":
      return "checkmate";
    case "resigned":
      return "resign";
    case "timeout":
      return "timeout";
    case "abandoned":
      return "abandoned";
    case "stalemate":
      return "stalemate";
    case "repetition":
      return "repetition";
    case "agreed":
      return "agreed";
    case "insufficient":
    case "timevsinsufficient":
      return "insufficient";
    default:
      return "other";
  }
}

const FAMILY_WORDS = new Set(["Variation", "Defense", "Attack", "Gambit", "System"]);

/** Opening name up to and including the first family word; the full name when none. */
export function openingFamily(name: string | null): string | null {
  if (!name) return null;
  const words = name.split(" ");
  const idx = words.findIndex((w) => FAMILY_WORDS.has(w));
  return idx === -1 ? name : words.slice(0, idx + 1).join(" ");
}

/** A PGN header value, or null. */
export function pgnTag(pgn: string | undefined, tag: string): string | null {
  if (!pgn) return null;
  const m = new RegExp(`\\[${tag} "([^"]*)"\\]`).exec(pgn);
  return m ? m[1] : null;
}

/** Half-moves in the movetext: SAN tokens after comments, move numbers and the result are dropped. */
export function plyCount(pgn: string | undefined): number | null {
  if (!pgn) return null;
  const split = pgn.indexOf("\n\n");
  const movetext = (split === -1 ? pgn : pgn.slice(split + 2)).replace(/\{[^}]*\}/g, " ").replace(/\([^)]*\)/g, " ");
  let count = 0;
  for (const token of movetext.split(/\s+/)) {
    if (!token || /^\d+\.+$/.test(token) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;
    count++;
  }
  return count;
}

/** ECOUrl header from a PGN, used when the archive game has no eco field. */
export function ecoUrlFromPgn(pgn: string | undefined): string | null {
  if (!pgn) return null;
  const m = /\[ECOUrl "([^"]+)"\]/.exec(pgn);
  return m ? m[1] : null;
}

/**
 * Maps one archive game to a chess_games row, or null when it is not a
 * rated standard game in the tracked time class or is missing a field.
 */
export function mapArchiveGame(raw: ArchiveGame, username: string, timeClass: string): ChessGameRow | null {
  if (raw.rules !== "chess" || raw.time_class !== timeClass || raw.rated !== true) return null;
  if (!raw.url || typeof raw.end_time !== "number" || !raw.fen || !raw.white || !raw.black) return null;

  const me = username.toLowerCase();
  let myColor: ChessColor;
  if (raw.white.username?.toLowerCase() === me) myColor = "white";
  else if (raw.black.username?.toLowerCase() === me) myColor = "black";
  else return null;

  const mine = myColor === "white" ? raw.white : raw.black;
  const opp = myColor === "white" ? raw.black : raw.white;
  if (typeof mine.rating !== "number" || typeof opp.rating !== "number" || !mine.result || !opp.username) return null;

  const ecoUrl = raw.eco ?? ecoUrlFromPgn(raw.pgn);
  const openingName = openingNameFromEcoUrl(ecoUrl);
  const oppResult = opp.result ?? null;
  const myAcc = raw.accuracies?.[myColor];
  const oppAcc = raw.accuracies?.[myColor === "white" ? "black" : "white"];

  return {
    game_url: raw.url,
    end_time: raw.end_time,
    time_class: raw.time_class,
    my_color: myColor,
    my_rating: mine.rating,
    my_result: mine.result,
    outcome: outcomeFromResult(mine.result),
    opp_username: opp.username,
    opp_rating: opp.rating,
    eco_url: ecoUrl,
    opening_name: openingName,
    final_fen: raw.fen,
    last_move_from: null,
    last_move_to: null,
    opp_result: oppResult,
    termination: terminationFrom(mine.result, oppResult),
    eco: pgnTag(raw.pgn, "ECO"),
    opening_family: openingFamily(openingName),
    ply_count: plyCount(raw.pgn),
    time_control: raw.time_control ?? pgnTag(raw.pgn, "TimeControl"),
    cc_accuracy_me: typeof myAcc === "number" ? myAcc : null,
    cc_accuracy_opp: typeof oppAcc === "number" ? oppAcc : null,
    pgn: raw.pgn ?? null,
  };
}

export function mapArchive(archive: ArchiveResponse, username: string, timeClass: string): ChessGameRow[] {
  const rows: ChessGameRow[] = [];
  for (const game of archive.games ?? []) {
    const row = mapArchiveGame(game, username, timeClass);
    if (row) rows.push(row);
  }
  return rows;
}
