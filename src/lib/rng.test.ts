import { describe, expect, it } from "vitest";
import { hashStringToUint, mulberry32 } from "./rng";

// Fixtures recorded from the original implementation in InferenceOverlay.tsx
// before it moved here, so a behavior change in the move would fail this test.
describe("mulberry32", () => {
  it("yields a fixed sequence for seed 42", () => {
    const rng = mulberry32(42);
    expect([rng(), rng(), rng(), rng(), rng()]).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
      0.17481389874592423,
    ]);
  });

  it("stays in [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hashStringToUint", () => {
  it("is stable for known strings", () => {
    expect(hashStringToUint("")).toBe(2166136261);
    expect(hashStringToUint("hero")).toBe(456875097);
    expect(hashStringToUint("samueljbaker.dev")).toBe(3375829304);
  });
});
