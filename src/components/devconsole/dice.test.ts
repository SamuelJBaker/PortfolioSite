import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../lib/rng";
import { parseDice, rollDice, uint32FromFloat, uniformInt, type Uint32Source } from "./dice";

const seeded = (seed: number): Uint32Source => uint32FromFloat(mulberry32(seed));

describe("parseDice grammar", () => {
  it("accepts the documented forms", () => {
    expect(parseDice("")).toEqual({ count: 1, sides: 20, modifier: 0, mode: "normal" });
    expect(parseDice("d20")).toEqual({ count: 1, sides: 20, modifier: 0, mode: "normal" });
    expect(parseDice("2d6")).toEqual({ count: 2, sides: 6, modifier: 0, mode: "normal" });
    expect(parseDice("3d8+2")).toEqual({ count: 3, sides: 8, modifier: 2, mode: "normal" });
    expect(parseDice("d20-1")).toEqual({ count: 1, sides: 20, modifier: -1, mode: "normal" });
    expect(parseDice("20d100+99")).toEqual({ count: 20, sides: 100, modifier: 99, mode: "normal" });
    expect(parseDice("adv")).toEqual({ count: 2, sides: 20, modifier: 0, mode: "adv" });
    expect(parseDice("dis")).toEqual({ count: 2, sides: 20, modifier: 0, mode: "dis" });
    expect(parseDice("adv+5")).toEqual({ count: 2, sides: 20, modifier: 5, mode: "adv" });
    expect(parseDice("  D6 ")).toEqual({ count: 1, sides: 6, modifier: 0, mode: "normal" });
  });

  it("rejects everything else", () => {
    for (const bad of ["0d6", "21d6", "d7", "d1000", "2d6+100", "2d6-100", "d", "2d", "x", "2d6 adv", "adv dis", "d20+", "1.5d6", "d20++1"]) {
      expect(parseDice(bad), bad).toBeNull();
    }
  });
});

describe("rollDice", () => {
  it("keeps every die in range over many rolls", () => {
    const source = seeded(7);
    for (const sides of [2, 4, 6, 8, 10, 12, 20, 100]) {
      const spec = parseDice(`20d${sides}`)!;
      for (let i = 0; i < 50; i += 1) {
        const r = rollDice(spec, source);
        expect(r.rolls).toHaveLength(20);
        for (const d of r.rolls) {
          expect(d).toBeGreaterThanOrEqual(1);
          expect(d).toBeLessThanOrEqual(sides);
        }
        expect(r.total).toBe(r.rolls.reduce((a, b) => a + b, 0));
      }
    }
  });

  it("repeats exactly under the same seed", () => {
    const run = () => {
      const source = seeded(42);
      return ["", "2d6+3", "adv", "dis-1", "5d10"].map((e) => rollDice(parseDice(e)!, source).text);
    };
    const a = run();
    expect(run()).toEqual(a);
    expect(a).not.toEqual(["", "2d6+3", "adv", "dis-1", "5d10"].map((e) => rollDice(parseDice(e)!, seeded(43)).text));
  });

  it("formats like the handoff examples", () => {
    const fixed = (values: number[]): Uint32Source => {
      let i = 0;
      return () => values[i++ % values.length] - 1; // x mod sides + 1 == value for small x
    };
    expect(rollDice(parseDice("2d6+3")!, fixed([4, 6])).text).toBe("2d6+3: [4, 6] +3 = 13");
    expect(rollDice(parseDice("adv")!, fixed([7, 20])).text).toBe("d20 adv: [7, 20] keep 20 = 20");
    expect(rollDice(parseDice("dis-1")!, fixed([7, 20])).text).toBe("d20 dis-1: [7, 20] keep 7 -1 = 6");
    expect(rollDice(parseDice("d20")!, fixed([14])).text).toBe("d20: [14] = 14");
  });

  it("flags naturals only on a single kept d20, before the modifier", () => {
    const fixed = (values: number[]): Uint32Source => {
      let i = 0;
      return () => values[i++ % values.length] - 1;
    };
    expect(rollDice(parseDice("d20")!, fixed([20])).natural).toBe("nat20");
    expect(rollDice(parseDice("d20")!, fixed([1])).natural).toBe("nat1");
    expect(rollDice(parseDice("adv")!, fixed([7, 20])).natural).toBe("nat20");
    expect(rollDice(parseDice("dis")!, fixed([1, 20])).natural).toBe("nat1");
    // Modifier does not make or break a natural.
    expect(rollDice(parseDice("d20-5")!, fixed([20])).natural).toBe("nat20");
    expect(rollDice(parseDice("d20+5")!, fixed([15])).natural).toBeNull();
    // Two kept dice or other sides never count.
    expect(rollDice(parseDice("2d20")!, fixed([20, 20])).natural).toBeNull();
    expect(rollDice(parseDice("d100")!, fixed([20])).natural).toBeNull();
    expect(rollDice(parseDice("d12")!, fixed([1])).natural).toBeNull();
    expect(rollDice(parseDice("adv")!, fixed([1, 20])).natural).toBe("nat20");
    expect(rollDice(parseDice("dis")!, fixed([7, 20])).natural).toBeNull();
  });
});

describe("uniformInt rejection sampling", () => {
  it("redraws at and above floor(2^32 / sides) * sides", () => {
    const limit = Math.floor(4294967296 / 6) * 6;
    const draws = [4294967295, limit, limit - 1];
    let calls = 0;
    const source: Uint32Source = () => draws[calls++];
    expect(uniformInt(6, source)).toBe(((limit - 1) % 6) + 1);
    expect(calls).toBe(3);
  });

  it("maps the smallest draws onto faces 1..sides", () => {
    for (let x = 0; x < 20; x += 1) expect(uniformInt(20, () => x)).toBe(x + 1);
  });

  it("uint32FromFloat covers the full 32-bit range", () => {
    expect(uint32FromFloat(() => 0)()).toBe(0);
    expect(uint32FromFloat(() => 0.5)()).toBe(2147483648);
    expect(uint32FromFloat(() => 1 - 2 ** -32)()).toBe(4294967295);
  });
});
