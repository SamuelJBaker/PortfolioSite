/**
 * Move classification for the chess review (phase 6c). Pure functions; the
 * engine work happens in scripts/chess-review/run.ts on James's machine.
 *
 * Every evaluation is from the mover's point of view in centipawns, clamped
 * to [-CP_LIMIT, CP_LIMIT]; a mate score maps to +CP_LIMIT or -CP_LIMIT.
 * The labels are our own analysis, never chess.com's.
 */

export const CLASSES = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
] as const;
export type MoveClass = (typeof CLASSES)[number];

export const CP_LIMIT = 1000;
const WIN_K = 0.00368208;

export function clampCp(cp: number): number {
  return Math.max(-CP_LIMIT, Math.min(CP_LIMIT, cp));
}

/** Mate in n (positive: the mover mates) to the clamped centipawn scale. */
export function mateToCp(mate: number): number {
  return mate > 0 ? CP_LIMIT : -CP_LIMIT;
}

/** Win percent for the mover: 50 + 50 * (2 / (1 + exp(-k cp)) - 1). */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_K * clampCp(cp))) - 1);
}

/** Expected points lost by playing `played` instead of `best`, floored at 0. */
export function expectedLoss(bestCp: number, playedCp: number): number {
  return Math.max(0, (winPercent(bestCp) - winPercent(playedCp)) / 100);
}

/** Base class from the loss; the engine's first choice is "best" whatever the loss. */
export function baseClass(loss: number, isEngineFirst: boolean): MoveClass {
  if (isEngineFirst) return "best";
  if (loss <= 0.02) return "excellent";
  if (loss <= 0.05) return "good";
  if (loss <= 0.1) return "inaccuracy";
  if (loss <= 0.2) return "mistake";
  return "blunder";
}

/** Per-move accuracy, 0..100, from the win-percent drop d. */
export function moveAccuracy(bestCp: number, playedCp: number): number {
  const d = Math.max(0, winPercent(bestCp) - winPercent(playedCp));
  const a = 103.1668 * Math.exp(-0.04354 * d) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

export interface MoveInput {
  /** Engine's top line from the position before the move, mover's POV. */
  bestCp: number;
  /** Evaluation after the move actually played, mover's POV. */
  playedCp: number;
  /** The played move is the engine's first choice. */
  isEngineFirst: boolean;
  /** MultiPV 2 score from the position before the move, mover's POV; null when there is no second line. */
  secondCp: number | null;
  /** The position after the move is in the openings set. */
  inBook: boolean;
  /**
   * Mover's material balance (1, 3, 3, 5, 9) after the engine's best reply
   * minus the balance before the move; negative means the move gave up
   * material.
   */
  materialDelta: number;
  /** Same, counting pieces only (no pawns); pawn-only sacrifices are not brilliant. */
  nonPawnDelta: number;
  /** The move captures on the square the opponent just captured on. */
  isRecapture: boolean;
  /** Expected-points loss of the opponent's previous move; null on the first ply. */
  prevOppLoss: number | null;
}

export interface MoveResult {
  cls: MoveClass;
  base: MoveClass;
  loss: number;
  accuracy: number;
}

/**
 * Classifies one move. Overrides are checked in order and the first that
 * applies wins: book, brilliant, great, miss. Otherwise the base class.
 */
export function classify(m: MoveInput): MoveResult {
  const loss = expectedLoss(m.bestCp, m.playedCp);
  const base = baseClass(loss, m.isEngineFirst);
  const accuracy = moveAccuracy(m.bestCp, m.playedCp);
  let cls: MoveClass = base;

  if (m.inBook) {
    cls = "book";
  } else if (
    (base === "best" || base === "excellent") &&
    m.materialDelta < 0 &&
    m.nonPawnDelta < 0 &&
    winPercent(m.playedCp) >= 35 &&
    winPercent(m.playedCp) <= 90
  ) {
    cls = "brilliant";
  } else if (
    base === "best" &&
    m.secondCp !== null &&
    (winPercent(m.bestCp) - winPercent(m.secondCp)) / 100 >= 0.1 &&
    !m.isRecapture
  ) {
    cls = "great";
  } else if (m.prevOppLoss !== null && m.prevOppLoss >= 0.2 && loss >= 0.1 && base !== "blunder") {
    cls = "miss";
  }

  return { cls, base, loss, accuracy };
}

/** Mean move accuracy for one side, book moves excluded; null with nothing to average. */
export function gameAccuracy(moves: readonly { cls: MoveClass; accuracy: number }[]): number | null {
  const scored = moves.filter((m) => m.cls !== "book");
  if (scored.length === 0) return null;
  return scored.reduce((s, m) => s + m.accuracy, 0) / scored.length;
}

export type ClassCounts = Partial<Record<MoveClass, number>>;

export function countClasses(moves: readonly { cls: MoveClass }[]): ClassCounts {
  const out: ClassCounts = {};
  for (const m of moves) out[m.cls] = (out[m.cls] ?? 0) + 1;
  return out;
}
