import { CLASSES, type MoveClass } from "../../lib/chess/classify";

/**
 * Move-class presentation, defined once. Every use pairs the color with the
 * glyph and the word, so color is never the only carrier. The four hex
 * values and the two non-token tints are the ones the phase 6c brief names;
 * everything else is a token from globals.css.
 */
export interface ClassMeta {
  word: string;
  glyph: string;
  /** CSS color value for text and fills. */
  color: string;
}

export const CLASS_META: Record<MoveClass, ClassMeta> = {
  brilliant: { word: "brilliant", glyph: "!!", color: "#c9d4f0" },
  great: { word: "great", glyph: "!", color: "#9fb4e8" },
  best: { word: "best", glyph: "*", color: "var(--color-accent)" },
  excellent: { word: "excellent", glyph: "+", color: "var(--color-accent-text)" },
  good: { word: "good", glyph: "", color: "var(--color-body)" },
  book: { word: "book", glyph: "bk", color: "#7b7c84" },
  inaccuracy: { word: "inaccuracy", glyph: "?!", color: "#c98a3c" },
  mistake: { word: "mistake", glyph: "?", color: "#d9773c" },
  miss: { word: "miss", glyph: "x", color: "#f87171b3" },
  blunder: { word: "blunder", glyph: "??", color: "#f87171" },
};

/** Display order, as the brief lists the classes. */
export const CLASS_ORDER: readonly MoveClass[] = CLASSES;

/** "!! brilliant", "best", "?? blunder": glyph (when any) plus the word. */
export function classLabel(cls: MoveClass): string {
  const m = CLASS_META[cls];
  return m.glyph ? `${m.glyph} ${m.word}` : m.word;
}
