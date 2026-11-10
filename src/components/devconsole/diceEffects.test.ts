import { beforeEach, describe, expect, it } from "vitest";
import type { EffectEvent } from "../background3d/BackgroundEffectsProvider";
import { parseDice, rollDice, type Uint32Source } from "./dice";
import { NATURAL_COOLDOWN_MS, SPAM_LIMIT, SPAM_PENALTY_MS, pulseIntensity, resetDiceGuards, runDiceEffects } from "./diceEffects";

const fixed = (values: number[]): Uint32Source => {
  let i = 0;
  return () => values[i++ % values.length] - 1;
};
const bus = (events: EffectEvent[]) => ({ emitEffect: (e: EffectEvent) => void events.push(e), subscribeEffect: () => () => {} });

describe("runDiceEffects", () => {
  beforeEach(() => resetDiceGuards());

  it("emits a dice event and a scaled system pulse for ordinary rolls", () => {
    const events: EffectEvent[] = [];
    const result = rollDice(parseDice("d20")!, fixed([10]));
    expect(runDiceEffects(result, bus(events), false, 0)).toEqual({ tired: false, cooldown: false, natural: null });
    expect(events[0]).toEqual({ type: "dice", outcome: "roll", value: 10, sides: 20 });
    expect(events[1]).toMatchObject({ type: "pulse", options: { mode: "system", intensity: 0.3 + 0.5 * (10 / 20) } });
    expect(pulseIntensity(rollDice(parseDice("2d6")!, fixed([6, 6])))).toBe(0.8);
  });

  it("fires naturals with the right pulse mode and honours the cooldown", () => {
    const events: EffectEvent[] = [];
    const nat20 = rollDice(parseDice("d20")!, fixed([20]));
    const nat1 = rollDice(parseDice("d20")!, fixed([1]));
    expect(runDiceEffects(nat20, bus(events), true, 1000).natural).toBe("nat20");
    expect(events).toEqual([
      { type: "dice", outcome: "nat20", value: 20, sides: 20 },
      { type: "pulse", options: { intensity: 1.0, durationMs: 1100, mode: "ai" } },
    ]);
    events.length = 0;
    expect(runDiceEffects(nat1, bus(events), true, 1000 + NATURAL_COOLDOWN_MS - 1)).toEqual({ tired: false, cooldown: true, natural: null });
    expect(events).toEqual([]);
    expect(runDiceEffects(nat1, bus(events), true, 1000 + NATURAL_COOLDOWN_MS).natural).toBe("nat1");
    expect(events[1]).toEqual({ type: "pulse", options: { intensity: 0.8, durationMs: 900, mode: "neutral" } });
  });

  it("goes tired after more than 10 rolls in 5 s and skips effects for 5 s", () => {
    const events: EffectEvent[] = [];
    const roll = rollDice(parseDice("d6")!, fixed([3]));
    for (let i = 0; i < SPAM_LIMIT; i += 1) expect(runDiceEffects(roll, bus(events), false, i * 100).tired).toBe(false);
    const trip = SPAM_LIMIT * 100;
    expect(runDiceEffects(roll, bus(events), false, trip).tired).toBe(true);
    const before = events.length;
    expect(runDiceEffects(roll, bus(events), false, trip + SPAM_PENALTY_MS - 1).tired).toBe(true);
    expect(events.length).toBe(before);
    expect(runDiceEffects(roll, bus(events), false, trip + SPAM_PENALTY_MS + 5000).tired).toBe(false);
  });
});
