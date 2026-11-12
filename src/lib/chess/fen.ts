/**
 * Board from the first FEN field only: ranks 8..1 split on "/", digits are
 * runs of empty squares. Returns 8 rows of 8 cells, row 0 = rank 8, col 0 =
 * file a; a cell is a piece letter (uppercase white, lowercase black) or null.
 * Returns null when the field is not 8 ranks of 8 squares.
 */
export type BoardCell = string | null;
export type Board = BoardCell[][];

const PIECES = new Set("KQRBNPkqrbnp");

export function parseFenBoard(fen: string): Board | null {
  const field = fen.trim().split(/\s+/)[0];
  const ranks = field.split("/");
  if (ranks.length !== 8) return null;
  const board: Board = [];
  for (const rank of ranks) {
    const row: BoardCell[] = [];
    for (const ch of rank) {
      if (ch >= "1" && ch <= "8") {
        for (let i = 0; i < Number(ch); i++) row.push(null);
      } else if (PIECES.has(ch)) {
        row.push(ch);
      } else {
        return null;
      }
    }
    if (row.length !== 8) return null;
    board.push(row);
  }
  return board;
}

/** Rows and columns as seen from `color`: white keeps rank 8 on top, black flips both axes. */
export function orientBoard(board: Board, color: "white" | "black"): Board {
  if (color === "white") return board;
  return board
    .slice()
    .reverse()
    .map((row) => row.slice().reverse());
}
