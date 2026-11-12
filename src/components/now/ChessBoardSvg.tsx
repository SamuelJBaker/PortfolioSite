import * as React from "react";
import { orientBoard, parseFenBoard } from "../../lib/chess/fen";
import { outcomeWord } from "../../lib/chess/format";

const SQUARE = 20;
const SIZE = SQUARE * 8;

/**
 * Final position from a FEN, oriented to my color. Site palette only: panel
 * and line tokens for the squares, Geist Mono letters for the pieces (white
 * uppercase in neutral-100, black lowercase in neutral-400). No last-move
 * tint: the ingest skips PGN parsing.
 */
export function ChessBoardSvg({
  fen,
  myColor,
  outcome,
  className,
}: {
  fen: string;
  myColor: "white" | "black";
  outcome: "W" | "L" | "D";
  className?: string;
}) {
  const parsed = parseFenBoard(fen);
  const board = parsed ? orientBoard(parsed, myColor) : null;
  const label = `Final position. I played ${myColor} and ${outcomeWord(outcome)}.`;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
      className={className}
      shapeRendering="crispEdges"
    >
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => {
          // From white's view a1 (row 7, col 0) is dark; the flipped board keeps the same parity.
          const dark = (row + col) % 2 === 1;
          return (
            <rect
              key={`${row}-${col}`}
              x={col * SQUARE}
              y={row * SQUARE}
              width={SQUARE}
              height={SQUARE}
              className={dark ? "fill-panel" : "fill-line"}
            />
          );
        })
      )}
      {board &&
        board.map((cells, row) =>
          cells.map((piece, col) =>
            piece ? (
              <text
                key={`p-${row}-${col}`}
                x={col * SQUARE + SQUARE / 2}
                y={row * SQUARE + SQUARE / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={600}
                className={
                  "font-mono select-none " +
                  (piece === piece.toUpperCase() ? "fill-neutral-100" : "fill-neutral-400")
                }
              >
                {piece}
              </text>
            ) : null
          )
        )}
    </svg>
  );
}
