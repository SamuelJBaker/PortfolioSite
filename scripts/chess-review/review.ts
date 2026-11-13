// Turns one game's PGN plus engine analyses into a chess_reviews row.
// Pure apart from the Engine interface, so tests can pass a fake engine.

import { Chess, type Color, type Move } from "chess.js";
import {
  CP_LIMIT,
  classify,
  clampCp,
  countClasses,
  gameAccuracy,
  mateToCp,
  type ClassCounts,
  type MoveClass,
  type MoveInput,
} from "../../src/lib/chess/classify.ts";
import type { Analysis, Engine, EngineLine } from "./uci.ts";

export interface ReviewedMove {
  /** Class of the move at this ply. */
  c: MoveClass;
  /** Evaluation after the move, centipawns from white's point of view, clamped. */
  e: number;
  /** Mate distance from white's point of view after the move, or null. */
  m: number | null;
}

export interface ReviewedGame {
  plies: number;
  accMe: number | null;
  accOpp: number | null;
  countsMe: ClassCounts;
  countsOpp: ClassCounts;
  moves: ReviewedMove[];
  /** Per-ply detail for the spot check. */
  detail: { ply: number; san: string; mover: Color; cls: MoveClass; loss: number; accuracy: number; bestCp: number; playedCp: number }[];
}

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/** Material for `color` minus the other side's; `pawns` false counts pieces only. */
export function materialBalance(fen: string, color: Color, pawns = true): number {
  const game = new Chess(fen);
  let mine = 0;
  let theirs = 0;
  for (const row of game.board()) {
    for (const sq of row) {
      if (!sq || (!pawns && sq.type === "p")) continue;
      if (sq.color === color) mine += VALUES[sq.type];
      else theirs += VALUES[sq.type];
    }
  }
  return mine - theirs;
}

/** A line's score from the side to move, on the clamped centipawn scale. */
export function lineCp(line: EngineLine | undefined): number | null {
  if (!line) return null;
  if (line.mate !== null) return mateToCp(line.mate);
  if (line.cp !== null) return clampCp(line.cp);
  return null;
}

/** Score of a terminal position (no legal moves) from the side to move. */
function terminalCp(fen: string): number {
  const game = new Chess(fen);
  return game.isCheckmate() ? -CP_LIMIT : 0;
}

function uci(move: Move): string {
  return move.from + move.to + (move.promotion ?? "");
}

/** Applies a UCI move to a FEN; null when it is not legal. */
export function applyUci(fen: string, move: string): string | null {
  try {
    const game = new Chess(fen);
    game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move.slice(4) || undefined });
    return game.fen();
  } catch {
    return null;
  }
}

/**
 * Reviews a game. Analyses every position (start, then after each ply) once;
 * ply i's "best" is the analysis before it and its "played" is the negated
 * top line of the analysis after it.
 */
export async function reviewGame(
  pgn: string,
  myColor: Color,
  engine: Engine,
  book: ReadonlySet<string>,
  depth: number
): Promise<ReviewedGame> {
  const game = new Chess();
  game.loadPgn(pgn);
  const history = game.history({ verbose: true });
  const fens = [history[0]?.before ?? new Chess().fen(), ...history.map((m) => m.after)];

  const analyses: Analysis[] = [];
  for (const fen of fens) analyses.push(await engine.analyze(fen, depth));

  const moves: ReviewedMove[] = [];
  const detail: ReviewedGame["detail"] = [];
  const perSide: Record<Color, { cls: MoveClass; accuracy: number }[]> = { w: [], b: [] };
  let prevLoss: number | null = null;
  let prevMove: Move | null = null;

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    const mover = move.color;
    const before = analyses[i];
    const after = analyses[i + 1];

    const bestCp = lineCp(before.lines[0]) ?? terminalCp(fens[i]);
    const secondCp = lineCp(before.lines[1]);
    // The analysis after the move is from the opponent's side: negate it.
    const afterTop = lineCp(after.lines[0]);
    const playedCp = afterTop === null ? -terminalCp(fens[i + 1]) : -afterTop;

    const replyFen = after.bestmove ? applyUci(fens[i + 1], after.bestmove) : null;
    const settled = replyFen ?? fens[i + 1];
    const input: MoveInput = {
      bestCp,
      playedCp,
      isEngineFirst: before.bestmove === uci(move),
      secondCp,
      inBook: book.has(positionKey(move.after)),
      materialDelta: materialBalance(settled, mover) - materialBalance(fens[i], mover),
      nonPawnDelta: materialBalance(settled, mover, false) - materialBalance(fens[i], mover, false),
      isRecapture: !!(prevMove && prevMove.captured && move.captured && move.to === prevMove.to),
      prevOppLoss: prevLoss,
    };
    const r = classify(input);

    // Evaluation after the move from white's point of view. The analysis after
    // the move is from the opponent's side, so its mate distance is negated
    // for the mover and then signed for white.
    const whiteSign = mover === "w" ? 1 : -1;
    const mateAfter = after.lines[0]?.mate ?? null;
    moves.push({
      c: r.cls,
      e: whiteSign * playedCp,
      m: mateAfter === null ? null : whiteSign * -mateAfter,
    });
    detail.push({ ply: i + 1, san: move.san, mover, cls: r.cls, loss: r.loss, accuracy: r.accuracy, bestCp, playedCp });
    perSide[mover].push({ cls: r.cls, accuracy: r.accuracy });
    prevLoss = r.loss;
    prevMove = move;
  }

  const me = myColor;
  const opp: Color = myColor === "w" ? "b" : "w";
  return {
    plies: history.length,
    accMe: gameAccuracy(perSide[me]),
    accOpp: gameAccuracy(perSide[opp]),
    countsMe: countClasses(perSide[me]),
    countsOpp: countClasses(perSide[opp]),
    moves,
    detail,
  };
}
