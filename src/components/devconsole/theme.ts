/**
 * One palette for the console, the HUD and the DevTools greeting. Navy is a
 * surface only here: the console is an "engine window", distinct from the site.
 * Text colors come from the phase 2 tokens where a CSS variable is usable;
 * `%c` console styling cannot read variables, so the hex twins sit beside them.
 */
export const consoleTheme = {
  panel: "rgba(11, 16, 32, 0.92)",
  panelHex: "#0b1020",
  text: "#eef1f8",
  accent: "var(--color-accent)",
  accentHex: "#d4af5a",
  error: "#f87171",
  muted: "#94a0b8",
  border: "rgba(212, 175, 90, 0.35)",
  fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "13px",
} as const;

export const CONSOLE_SLIDE_MS = 120;
