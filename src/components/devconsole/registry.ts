import type { EffectBus } from "../background3d/BackgroundEffectsProvider";
import type { Telemetry } from "./telemetry";

/** One scrollback line. `href` renders the text as a link; "gold" is for critical successes. */
export type ConsoleLine = { kind: "in" | "out" | "err" | "sys" | "gold"; text: string; href?: string };
export type LineKind = ConsoleLine["kind"];

export type CommandContext = {
  /** Appends a line and returns its id, for updateLine. */
  print: (text: string, kind?: LineKind) => number;
  printLink: (text: string, href: string) => void;
  /** Rewrites a line in place (the dice flicker). */
  updateLine: (id: number, text: string, kind?: LineKind) => void;
  clear: () => void;
  close: () => void;
  effects: EffectBus;
  telemetry: Readonly<Telemetry>;
  scrollTo: (sectionId: string) => void;
  /** http(s) opens a new tab, mailto opens a draft, anything else is a client navigation. */
  navigate: (href: string) => void;
  /** Uniform float in [0, 1): seeded mulberry32 or crypto-backed. */
  rng: () => number;
  setSeed: (seed: number | null) => void;
  getSeed: () => number | null;
  reducedMotion: boolean;
  /** Command history, oldest first. */
  history: readonly string[];
  /** Section ids on the current page, in document order. */
  sections: () => string[];
  /** Toggles the HUD and returns its new state. */
  toggleHud: () => boolean;
};

export type Command = {
  name: string;
  aliases?: string[];
  /** One line for help. */
  summary: string;
  /** e.g. "roll [NdM][+K] [adv|dis]" */
  usage?: string;
  /** Left out of help and tab completion. */
  hidden?: boolean;
  run: (args: string[], ctx: CommandContext) => void | Promise<void>;
  complete?: (partial: string, ctx: CommandContext) => string[];
};

const commands: Command[] = [];
const byName = new Map<string, Command>();

export function register(cmd: Command): void {
  if (byName.has(cmd.name)) return; // commands/index.ts may be evaluated once per chunk load
  commands.push(cmd);
  byName.set(cmd.name, cmd);
  for (const alias of cmd.aliases ?? []) byName.set(alias, cmd);
}

export function resolve(name: string): Command | undefined {
  return byName.get(name.toLowerCase());
}

/** Registered commands in registration order; hidden ones included. */
export function list(): readonly Command[] {
  return commands;
}

/** Tests only. */
export function resetRegistry(): void {
  commands.length = 0;
  byName.clear();
}

/**
 * Splits a line into a lowercased command name and its arguments. Arguments
 * split on whitespace; "quoted strings" stay whole with the quotes removed.
 * Returns null for a blank line.
 */
export function parseLine(line: string): { name: string; args: string[] } | null {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  let hasToken = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote;
      hasToken = true;
      continue;
    }
    if (!inQuote && /\s/.test(ch)) {
      if (hasToken) {
        tokens.push(current);
        current = "";
        hasToken = false;
      }
      continue;
    }
    current += ch;
    hasToken = true;
  }
  if (hasToken) tokens.push(current);
  if (tokens.length === 0) return null;
  const [first, ...args] = tokens;
  return { name: first.toLowerCase(), args };
}

export function unknownCommandMessage(name: string): string {
  return `Unknown command: ${name}. Type help.`;
}

/** Parses and runs one line. Errors print in red and never propagate. */
export async function runLine(line: string, ctx: CommandContext): Promise<void> {
  const parsed = parseLine(line);
  if (!parsed) return;
  const cmd = resolve(parsed.name);
  if (!cmd) {
    ctx.print(unknownCommandMessage(parsed.name), "err");
    return;
  }
  try {
    await cmd.run(parsed.args, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.print(`Error: ${message}`, "err");
  }
}

/**
 * Tab completion. Without a space the command names are completed; with one,
 * the command's own complete() handles the last argument.
 */
export function completeLine(line: string, ctx: CommandContext): string[] {
  const firstSpace = line.indexOf(" ");
  if (firstSpace < 0) {
    const partial = line.toLowerCase();
    return commands.filter((c) => !c.hidden && c.name.startsWith(partial)).map((c) => c.name);
  }
  const cmd = resolve(line.slice(0, firstSpace));
  if (!cmd?.complete) return [];
  const partial = line.slice(line.lastIndexOf(" ") + 1);
  return cmd.complete(partial, ctx).filter((s) => s.startsWith(partial));
}
