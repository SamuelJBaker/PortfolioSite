import { Chess } from "chess.js";
import type { ChessReplay } from "./types";

/**
 * Server-side only: positions for the board replay from a stored PGN.
 * fens[0] is the start position and fens[i] the position after ply i;
 * sans[i - 1] and lastMoves[i - 1] describe ply i. Returns null when the PGN
 * is missing or does not parse, so the card falls back to the final FEN.
 */
export function replayFromPgn(pgn: string | null | undefined): ChessReplay | null {
  if (!pgn) return null;
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history({ verbose: true });
    if (moves.length === 0) return null;
    return {
      sans: moves.map((m) => m.san),
      fens: [moves[0].before, ...moves.map((m) => m.after)],
      lastMoves: moves.map((m) => [m.from, m.to] as [string, string]),
    };
  } catch {
    return null;
  }
}
