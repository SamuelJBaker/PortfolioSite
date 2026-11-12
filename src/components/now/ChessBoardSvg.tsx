import * as React from "react";
import { orientBoard, parseFenBoard } from "../../lib/chess/fen";
import { outcomeWord } from "../../lib/chess/format";
import { pieceSymbolId } from "../chess/Pieces";

const SQUARE = 20;
const SIZE = SQUARE * 8;

/**
 * Final position from a FEN, oriented to my color. Site palette only: panel
 * and line tokens for the squares, the Cburnett sprite for the pieces
 * (PieceDefs must be mounted once on the page). No last-move tint here.
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
              <use
                key={`p-${row}-${col}`}
                href={`#${pieceSymbolId(piece)}`}
                x={col * SQUARE}
                y={row * SQUARE}
                width={SQUARE}
                height={SQUARE}
              />
            ) : null
          )
        )}
    </svg>
  );
}
