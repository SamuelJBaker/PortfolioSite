/**
 * Dice notation parser and roller. Pure: no DOM, no React, no effects. The
 * roll command and window.sjb.roll() both go through here.
 */
import { hashStringToUint } from "../../lib/rng";

export const DICE_SIDES = [2, 4, 6, 8, 10, 12, 20, 100] as const;
export const MAX_DICE = 20;
export const MAX_MODIFIER = 99;

export type DiceMode = "normal" | "adv" | "dis";
export type DiceSpec = { count: number; sides: number; modifier: number; mode: DiceMode };
export type Natural = "nat20" | "nat1" | null;
export type RollResult = {
  spec: DiceSpec;
  /** Every die rolled, in order. */
  rolls: number[];
  /** The dice that count toward the total (one of two under adv or dis). */
  kept: number[];
  total: number;
  /** Set only for a single kept d20, read before the modifier. */
  natural: Natural;
  /** Console line, e.g. "2d6+3: [4, 6] +3 = 13". */
  text: string;
};

/** Uniform unsigned 32-bit integer source. */
export type Uint32Source = () => number;

export const DICE_USAGE =
  "usage: roll [NdM][+K], roll adv[+K], roll dis[+K]. 1 to 20 dice; sides 2, 4, 6, 8, 10, 12, 20 or 100; modifier -99 to +99.";

const PATTERN = /^(\d{0,2})d(\d{1,3})([+-]\d{1,2})?$/;
const ADV_PATTERN = /^(adv|dis)([+-]\d{1,2})?$/;

/** Parses "2d6+3", "d20", "adv-1" or "" (a bare d20). Returns null for anything else. */
export function parseDice(input: string): DiceSpec | null {
  const text = input.trim().toLowerCase();
  if (text === "") return { count: 1, sides: 20, modifier: 0, mode: "normal" };

  const adv = ADV_PATTERN.exec(text);
  if (adv) {
    const modifier = adv[2] ? Number(adv[2]) : 0;
    return { count: 2, sides: 20, modifier, mode: adv[1] as DiceMode };
  }

  const m = PATTERN.exec(text);
  if (!m) return null;
  const count = m[1] === "" ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  const modifier = m[3] ? Number(m[3]) : 0;
  if (count < 1 || count > MAX_DICE) return null;
  if (!(DICE_SIDES as readonly number[]).includes(sides)) return null;
  if (Math.abs(modifier) > MAX_MODIFIER) return null;
  return { count, sides, modifier, mode: "normal" };
}

/**
 * Maps a uint32 onto 1..sides by rejection sampling, so no face is favored:
 * redraw while x >= floor(2^32 / sides) * sides, then (x mod sides) + 1.
 */
export function uniformInt(sides: number, source: Uint32Source): number {
  const limit = Math.floor(4294967296 / sides) * sides;
  let x = source() >>> 0;
  while (x >= limit) x = source() >>> 0;
  return (x % sides) + 1;
}

/** Adapts a float-in-[0,1) generator (mulberry32, crypto wrapper) to a uint32 source. */
export function uint32FromFloat(rng: () => number): Uint32Source {
  return () => Math.floor(rng() * 4294967296) >>> 0;
}

function formatModifier(modifier: number): string {
  if (modifier === 0) return "";
  return modifier > 0 ? `+${modifier}` : String(modifier);
}

export function rollDice(spec: DiceSpec, source: Uint32Source): RollResult {
  const rolls: number[] = [];
  for (let i = 0; i < spec.count; i += 1) rolls.push(uniformInt(spec.sides, source));

  let kept: number[];
  if (spec.mode === "adv") kept = [Math.max(...rolls)];
  else if (spec.mode === "dis") kept = [Math.min(...rolls)];
  else kept = rolls;

  const sum = kept.reduce((a, b) => a + b, 0);
  const total = sum + spec.modifier;

  let natural: Natural = null;
  if (spec.sides === 20 && kept.length === 1) {
    if (kept[0] === 20) natural = "nat20";
    else if (kept[0] === 1) natural = "nat1";
  }

  const mod = formatModifier(spec.modifier);
  const modText = mod ? ` ${mod}` : "";
  const list = `[${rolls.join(", ")}]`;
  const text =
    spec.mode === "normal"
      ? `${spec.count === 1 ? "" : spec.count}d${spec.sides}${mod}: ${list}${modText} = ${total}`
      : `d20 ${spec.mode}${mod}: ${list} keep ${kept[0]}${modText} = ${total}`;

  return { spec, rolls, kept, total, natural, text };
}

export const NAT20_TEXT = "NATURAL 20. Critical success.";
export const NAT1_TEXT = "NATURAL 1. Critical failure.";
export const NAT1_AFTER_TEXT = "The website rolled a saving throw. It passed. Barely.";

/** Seed from `seed <n>`: integers as given (mod 2^32), anything else hashed. */
export function seedFromArg(arg: string): number {
  return /^-?\d+$/.test(arg) ? Number(arg) >>> 0 : hashStringToUint(arg);
}
