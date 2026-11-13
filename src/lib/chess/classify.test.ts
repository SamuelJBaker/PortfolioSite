import { describe, expect, it } from "vitest";
import {
  baseClass,
  classify,
  countClasses,
  expectedLoss,
  gameAccuracy,
  mateToCp,
  moveAccuracy,
  winPercent,
  type MoveInput,
} from "./classify";

/** Centipawns (mover POV) that give win percent w; the inverse of winPercent. */
function cpForWin(w: number): number {
  const r = 2 / (1 + (w - 50) / 50) - 1;
  return -Math.log(r) / 0.00368208;
}

/** Played-move cp that loses exactly `loss` expected points from an even position. */
function playedForLoss(loss: number): number {
  return cpForWin(50 - loss * 100);
}

const base: MoveInput = {
  bestCp: 0,
  playedCp: 0,
  isEngineFirst: false,
  secondCp: null,
  inBook: false,
  materialDelta: 0,
  nonPawnDelta: 0,
  isRecapture: false,
  prevOppLoss: null,
};

describe("winPercent and loss", () => {
  it("is 50 at equality, symmetric, and saturates at the clamp", () => {
    expect(winPercent(0)).toBeCloseTo(50, 6);
    expect(winPercent(100) + winPercent(-100)).toBeCloseTo(100, 6);
    expect(winPercent(1000)).toBeCloseTo(winPercent(5000), 6);
    expect(winPercent(1000)).toBeGreaterThan(97);
  });
  it("mate maps to the clamp", () => {
    expect(mateToCp(1)).toBe(1000);
    expect(mateToCp(7)).toBe(1000);
    expect(mateToCp(-3)).toBe(-1000);
  });
  it("loss is floored at zero and measured in expected points", () => {
    expect(expectedLoss(0, 50)).toBe(0);
    expect(expectedLoss(0, playedForLoss(0.1))).toBeCloseTo(0.1, 6);
    expect(expectedLoss(mateToCp(2), 0)).toBeCloseTo((winPercent(1000) - 50) / 100, 6);
  });
});

describe("baseClass thresholds", () => {
  it("uses inclusive upper bounds", () => {
    expect(baseClass(0, true)).toBe("best");
    expect(baseClass(0.5, true)).toBe("best");
    expect(baseClass(0, false)).toBe("excellent");
    expect(baseClass(0.02, false)).toBe("excellent");
    expect(baseClass(0.0200001, false)).toBe("good");
    expect(baseClass(0.05, false)).toBe("good");
    expect(baseClass(0.0500001, false)).toBe("inaccuracy");
    expect(baseClass(0.1, false)).toBe("inaccuracy");
    expect(baseClass(0.1000001, false)).toBe("mistake");
    expect(baseClass(0.2, false)).toBe("mistake");
    expect(baseClass(0.2000001, false)).toBe("blunder");
  });
});

describe("moveAccuracy", () => {
  it("is 100 for no drop (the formula gives 99.9999) and falls with the drop, never below 0", () => {
    expect(moveAccuracy(0, 0)).toBeCloseTo(100, 3);
    expect(moveAccuracy(0, 100)).toBeCloseTo(100, 3);
    expect(moveAccuracy(0, playedForLoss(0.1))).toBeCloseTo(103.1668 * Math.exp(-0.4354) - 3.1669, 4);
    expect(moveAccuracy(1000, -1000)).toBe(0);
  });
});

describe("classify overrides", () => {
  it("book wins over everything", () => {
    expect(classify({ ...base, inBook: true, isEngineFirst: true }).cls).toBe("book");
    expect(classify({ ...base, inBook: true, playedCp: -900 }).cls).toBe("book");
  });

  it("brilliant needs a piece sacrifice, a sound move and a balanced position", () => {
    const sac = { ...base, isEngineFirst: true, materialDelta: -3, nonPawnDelta: -3 };
    expect(classify(sac).cls).toBe("brilliant");
    expect(classify({ ...sac, isEngineFirst: false, playedCp: playedForLoss(0.02) }).cls).toBe("brilliant");
    expect(classify({ ...sac, isEngineFirst: false, playedCp: playedForLoss(0.03) }).cls).not.toBe("brilliant");
    expect(classify({ ...sac, materialDelta: -1, nonPawnDelta: 0 }).cls).toBe("best"); // pawn only
    expect(classify({ ...sac, materialDelta: 0, nonPawnDelta: -3 }).cls).toBe("best"); // got it back
    expect(classify({ ...sac, bestCp: cpForWin(95), playedCp: cpForWin(95) }).cls).toBe("best"); // already winning
    expect(classify({ ...sac, bestCp: cpForWin(30), playedCp: cpForWin(30) }).cls).toBe("best"); // losing anyway
    expect(classify({ ...sac, bestCp: cpForWin(90), playedCp: cpForWin(90) }).cls).toBe("brilliant");
    expect(classify({ ...sac, bestCp: cpForWin(35), playedCp: cpForWin(35) }).cls).toBe("brilliant");
  });

  it("great needs the only good move and no recapture", () => {
    const only = { ...base, isEngineFirst: true, bestCp: 0, secondCp: cpForWin(40) };
    expect(classify(only).cls).toBe("great");
    expect(classify({ ...only, secondCp: cpForWin(40.5) }).cls).toBe("best");
    expect(classify({ ...only, isRecapture: true }).cls).toBe("best");
    expect(classify({ ...only, isEngineFirst: false }).cls).toBe("excellent");
    expect(classify({ ...only, secondCp: null }).cls).toBe("best");
  });

  it("brilliant beats great when both apply", () => {
    expect(classify({ ...base, isEngineFirst: true, secondCp: cpForWin(30), materialDelta: -3, nonPawnDelta: -3 }).cls).toBe("brilliant");
  });

  it("miss needs a big opponent error followed by a real loss, short of a blunder", () => {
    const miss = { ...base, prevOppLoss: 0.2, playedCp: playedForLoss(0.1) };
    expect(classify(miss).cls).toBe("miss");
    expect(classify({ ...miss, prevOppLoss: 0.19 }).cls).toBe("inaccuracy");
    expect(classify({ ...miss, playedCp: playedForLoss(0.09) }).cls).toBe("inaccuracy");
    expect(classify({ ...miss, playedCp: playedForLoss(0.3) }).cls).toBe("blunder");
    expect(classify({ ...miss, prevOppLoss: null }).cls).toBe("inaccuracy");
  });

  it("reports base, loss and accuracy with the class", () => {
    const r = classify({ ...base, playedCp: playedForLoss(0.15) });
    expect(r).toMatchObject({ cls: "mistake", base: "mistake" });
    expect(r.loss).toBeCloseTo(0.15, 6);
    expect(r.accuracy).toBeLessThan(60);
  });

  it("mate scores classify at the clamp", () => {
    expect(classify({ ...base, bestCp: mateToCp(1), playedCp: mateToCp(1), isEngineFirst: true }).cls).toBe("best");
    expect(classify({ ...base, bestCp: mateToCp(1), playedCp: 0 }).cls).toBe("blunder");
    expect(classify({ ...base, bestCp: mateToCp(-5), playedCp: mateToCp(-1) }).cls).toBe("excellent");
  });
});

describe("gameAccuracy and countClasses", () => {
  it("averages non-book moves and is null for a book-only game", () => {
    const moves = [
      { cls: "book" as const, accuracy: 100 },
      { cls: "book" as const, accuracy: 100 },
      { cls: "best" as const, accuracy: 100 },
      { cls: "mistake" as const, accuracy: 40 },
    ];
    expect(gameAccuracy(moves)).toBe(70);
    expect(gameAccuracy(moves.slice(0, 2))).toBeNull();
    expect(gameAccuracy([])).toBeNull();
    expect(countClasses(moves)).toEqual({ book: 2, best: 1, mistake: 1 });
  });
});
