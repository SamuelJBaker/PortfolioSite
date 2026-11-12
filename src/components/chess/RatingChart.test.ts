import { describe, expect, it } from "vitest";
import { nearestIndex, yDomain, yTicks } from "./RatingChart";

describe("yDomain", () => {
  it("zoom pads by max(15, 10 percent of the range)", () => {
    expect(yDomain([600, 640], 1200, "zoom")).toEqual([585, 655]);
    expect(yDomain([400, 700], 1200, "zoom")).toEqual([370, 730]);
    expect(yDomain([600], 1200, "zoom")).toEqual([585, 615]);
  });
  it("goal reaches from a floor of 50 to 20 above the goal", () => {
    expect(yDomain([478, 640], 1200, "goal")).toEqual([450, 1220]);
    expect(yDomain([500, 640], 1200, "goal")).toEqual([500, 1220]);
  });
});

describe("yTicks", () => {
  it("lists multiples of 25 inside the domain, at most six", () => {
    expect(yTicks([585, 655])).toEqual([600, 625, 650]);
    expect(yTicks([450, 1220])).toHaveLength(6);
    expect(yTicks([450, 1220])[0]).toBe(450);
    expect(yTicks([601, 620])).toEqual([]);
  });
});

describe("nearestIndex", () => {
  it("snaps to the closest x", () => {
    const xs = [0, 0.25, 0.5, 1];
    expect(nearestIndex(xs, 0.1)).toBe(0);
    expect(nearestIndex(xs, 0.2)).toBe(1);
    expect(nearestIndex(xs, 0.7)).toBe(2);
    expect(nearestIndex(xs, 2)).toBe(3);
    expect(nearestIndex(xs, -1)).toBe(0);
  });
});
