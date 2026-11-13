"use client";

import * as React from "react";
import { orientBoard, parseFenBoard } from "../../lib/chess/fen";
import { outcomeWord } from "../../lib/chess/format";
import type { MoveClass } from "../../lib/chess/classify";
import type { ChessColor, ChessOutcome } from "../../lib/chess/types";
import { CLASS_META } from "./classes";
import { pieceSymbolId } from "./Pieces";

const SQUARE = 32;
const SIZE = SQUARE * 8;
const FILES = "abcdefgh";

export interface BoardProps {
  /** fens[0] start, fens[i] after ply i. A single FEN renders a static board. */
  fens: string[];
  /** sans[i - 1] is ply i. */
  sans: string[];
  /** [from, to] per ply. */
  lastMoves: [string, string][];
  myColor: ChessColor;
  outcome: ChessOutcome;
  className?: string;
  /** Controlled ply; with onPlyChange the parent owns the position (eval strip scrubbing). */
  ply?: number;
  onPlyChange?: (ply: number) => void;
  /** moveClasses[i - 1] labels ply i when the game has a review. */
  moveClasses?: MoveClass[];
}

/** Row and column on the oriented board for a square name like "e4". */
export function squareCell(square: string, myColor: ChessColor): { row: number; col: number } | null {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  if (file === -1 || !(rank >= 1 && rank <= 8)) return null;
  // White view: rank 8 on top (row 0), file a on the left (col 0).
  const row = 8 - rank;
  const col = file;
  return myColor === "white" ? { row, col } : { row: 7 - row, col: 7 - col };
}

/** "21. Qf1#" for white's ply, "21... Nf6" for black's; "Start position" at ply 0. */
export function moveLabel(ply: number, sans: string[]): string {
  if (ply <= 0 || ply > sans.length) return "Start position";
  const moveNo = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${moveNo}. ${sans[ply - 1]}` : `${moveNo}... ${sans[ply - 1]}`;
}

const BTN =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel/60 font-mono text-xs text-body hover:border-accent/45 hover:text-neutral-100 aria-disabled:opacity-40 aria-disabled:hover:border-line aria-disabled:hover:text-body transition";

/**
 * Controls use aria-disabled rather than disabled: a button that disables
 * itself after a click would drop focus, and the arrow keys would stop
 * working until the user clicked back into the board.
 */
function ControlButton({ label, onClick, off, children }: { label: string; onClick: () => void; off: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className={BTN} aria-label={label} aria-disabled={off} onClick={off ? undefined : onClick}>
      {children}
    </button>
  );
}

/**
 * Replay board. Oriented to myColor, the current ply's from and to squares
 * tinted, controls and move label under it. Arrow keys step while the board
 * or its controls have focus; Home and End jump. Opens on the final position
 * so the default render matches the static board it replaces.
 */
export function Board({ fens, sans, lastMoves, myColor, outcome, className, ply: controlledPly, onPlyChange, moveClasses }: BoardProps) {
  const total = Math.max(0, fens.length - 1);
  const [ownPly, setOwnPly] = React.useState(total);
  // A different game (new fens) resets to its final position.
  const fensKey = fens[fens.length - 1] ?? "";
  const lastKeyRef = React.useRef(fensKey);
  if (lastKeyRef.current !== fensKey) {
    lastKeyRef.current = fensKey;
    setOwnPly(total);
  }
  const ply = controlledPly ?? ownPly;
  const current = Math.min(ply, total);
  const setPly = (next: number) => {
    setOwnPly(next);
    onPlyChange?.(next);
  };

  const parsed = parseFenBoard(fens[current] ?? "");
  const board = parsed ? orientBoard(parsed, myColor) : null;
  const move = current > 0 ? lastMoves[current - 1] : undefined;
  const tinted = move ? [squareCell(move[0], myColor), squareCell(move[1], myColor)] : [];

  const go = (next: number) => setPly(Math.max(0, Math.min(total, next)));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (total === 0) return;
    const map: Record<string, number> = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: total };
    if (e.key in map) {
      e.preventDefault();
      go(map[e.key]);
    }
  };

  const label = `Final position. I played ${myColor} and ${outcomeWord(outcome)}.`;
  const rankAt = (row: number) => (myColor === "white" ? 8 - row : row + 1);
  const fileAt = (col: number) => (myColor === "white" ? FILES[col] : FILES[7 - col]);

  return (
    <div className={className} onKeyDown={onKeyDown}>
      <div
        tabIndex={0}
        className="overflow-hidden rounded-xl border border-line bg-neutral-950/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
        aria-label={total ? `${label} Use the arrow keys to step through the moves.` : label}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} className="block h-auto w-full" shapeRendering="crispEdges">
          {Array.from({ length: 8 }, (_, row) =>
            Array.from({ length: 8 }, (_, col) => (
              <rect
                key={`${row}-${col}`}
                x={col * SQUARE}
                y={row * SQUARE}
                width={SQUARE}
                height={SQUARE}
                className={(row + col) % 2 === 1 ? "fill-panel" : "fill-line"}
              />
            ))
          )}
          {tinted.map((cell, i) =>
            cell ? (
              <rect
                key={`t-${i}`}
                x={cell.col * SQUARE}
                y={cell.row * SQUARE}
                width={SQUARE}
                height={SQUARE}
                className="fill-accent/18"
              />
            ) : null
          )}
          {Array.from({ length: 8 }, (_, row) => (
            <text
              key={`r-${row}`}
              x={3}
              y={row * SQUARE + 11}
              fontSize={10}
              className="fill-muted font-mono select-none"
              aria-hidden="true"
            >
              {rankAt(row)}
            </text>
          ))}
          {Array.from({ length: 8 }, (_, col) => (
            <text
              key={`f-${col}`}
              x={col * SQUARE + SQUARE - 3}
              y={SIZE - 3}
              fontSize={10}
              textAnchor="end"
              className="fill-muted font-mono select-none"
              aria-hidden="true"
            >
              {fileAt(col)}
            </text>
          ))}
          {board &&
            board.map((cells, row) =>
              cells.map((piece, col) =>
                piece ? (
                  <use key={`p-${row}-${col}`} href={`#${pieceSymbolId(piece)}`} x={col * SQUARE} y={row * SQUARE} width={SQUARE} height={SQUARE} />
                ) : null
              )
            )}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1" role="group" aria-label="Replay controls">
        <ControlButton label="First move" onClick={() => go(0)} off={total === 0 || current === 0}>
          |&lt;
        </ControlButton>
        <ControlButton label="Previous move" onClick={() => go(current - 1)} off={total === 0 || current === 0}>
          &lt;
        </ControlButton>
        <span className="font-mono text-xs text-muted tabular-nums">
          {current}/{total}
        </span>
        <ControlButton label="Next move" onClick={() => go(current + 1)} off={total === 0 || current === total}>
          &gt;
        </ControlButton>
        <ControlButton label="Last move" onClick={() => go(total)} off={total === 0 || current === total}>
          &gt;|
        </ControlButton>
      </div>
      <p className="mt-1.5 h-5 font-mono text-sm text-neutral-100" aria-live="polite">
        {total ? moveLabel(current, sans) : "Final position"}
        {total && current > 0 && moveClasses?.[current - 1] ? (
          <span className="ml-2 text-xs" style={{ color: CLASS_META[moveClasses[current - 1]].color }}>
            {CLASS_META[moveClasses[current - 1]].glyph ? `${CLASS_META[moveClasses[current - 1]].glyph} ` : ""}
            {CLASS_META[moveClasses[current - 1]].word}
          </span>
        ) : null}
      </p>
    </div>
  );
}
