import type { EffectBus } from "../background3d/BackgroundEffectsProvider";
import type { RollResult } from "./dice";

/**
 * Site-wide effects for a roll, plus the guards. Shared by the roll command
 * and window.sjb.roll(), so both obey the same cooldown and spam rules.
 * Module-level state: the guards count every roll on the page, whoever made it.
 */
export const NATURAL_COOLDOWN_MS = 1500;
export const SPAM_WINDOW_MS = 5000;
export const SPAM_LIMIT = 10;
export const SPAM_PENALTY_MS = 5000;
export const WAVE_MS = 1400;
export const GLITCH_MS = 900;
export const BORDER_FLASH_MS = 600;
export const GLITCH_CLASS = "fx-glitch";
export const TIRED_TEXT = "The dice are tired.";
export const COOLDOWN_TEXT = "(effect cooldown)";

export type DiceEffectOutcome = {
  /** Spam guard tripped: no effects at all. */
  tired: boolean;
  /** A natural landed inside the cooldown: message only, no animation. */
  cooldown: boolean;
  /** A natural effect was started. */
  natural: "nat20" | "nat1" | null;
};

const rollTimes: number[] = [];
let tiredUntil = 0;
let lastNaturalAt = -Infinity;
let glitchTimer: number | null = null;

/** Tests only. */
export function resetDiceGuards(): void {
  rollTimes.length = 0;
  tiredUntil = 0;
  lastNaturalAt = -Infinity;
}

/** Ordinary pulse strength: 0.3 + 0.5 x (value / sides), value being the kept dice. */
export function pulseIntensity(result: RollResult): number {
  const kept = result.kept.reduce((a, b) => a + b, 0);
  const max = result.kept.length * result.spec.sides;
  return 0.3 + 0.5 * (kept / max);
}

export function runDiceEffects(
  result: RollResult,
  effects: EffectBus,
  reducedMotion: boolean,
  now: number = typeof performance !== "undefined" ? performance.now() : Date.now()
): DiceEffectOutcome {
  // Spam guard: more than SPAM_LIMIT rolls inside SPAM_WINDOW_MS.
  while (rollTimes.length && now - rollTimes[0] > SPAM_WINDOW_MS) rollTimes.shift();
  rollTimes.push(now);
  if (rollTimes.length > SPAM_LIMIT) tiredUntil = now + SPAM_PENALTY_MS;
  if (now < tiredUntil) return { tired: true, cooldown: false, natural: null };

  const value = result.kept.reduce((a, b) => a + b, 0);
  const { sides } = result.spec;

  if (!result.natural) {
    effects.emitEffect({ type: "dice", outcome: "roll", value, sides });
    effects.emitEffect({
      type: "pulse",
      options: { mode: "system", intensity: pulseIntensity(result), durationMs: 700 },
    });
    return { tired: false, cooldown: false, natural: null };
  }

  // Natural effects never overlap.
  if (now - lastNaturalAt < NATURAL_COOLDOWN_MS) return { tired: false, cooldown: true, natural: null };
  lastNaturalAt = now;

  effects.emitEffect({ type: "dice", outcome: result.natural, value, sides });
  if (result.natural === "nat20") {
    effects.emitEffect({ type: "pulse", options: { intensity: 1.0, durationMs: 1100, mode: "ai" } });
  } else {
    effects.emitEffect({ type: "pulse", options: { intensity: 0.8, durationMs: 900, mode: "neutral" } });
    if (!reducedMotion) glitchPage();
  }
  return { tired: false, cooldown: false, natural: result.natural };
}

/** Adds fx-glitch to the [data-ui] wrapper for GLITCH_MS: transform and text-shadow only. */
function glitchPage() {
  if (typeof document === "undefined") return;
  const root = document.querySelector<HTMLElement>("[data-ui]");
  if (!root) return;
  root.classList.add(GLITCH_CLASS);
  if (glitchTimer !== null) window.clearTimeout(glitchTimer);
  glitchTimer = window.setTimeout(() => {
    root.classList.remove(GLITCH_CLASS);
    glitchTimer = null;
  }, GLITCH_MS);
}
