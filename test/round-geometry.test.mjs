import { describe, it, expect } from "vitest";
import {
  boxIntersectsScreen,
  centeredBox,
  safeHalfWidth,
  safeLineWidth,
} from "../lib/round-geometry.js";
import { ROUND_SIZES } from "./fixtures.mjs";

describe("safeHalfWidth", () => {
  it("is the full radius on the centre line", () => {
    expect(safeHalfWidth(100, 0)).toBe(100);
  });

  it("shrinks towards the top and bottom of the circle", () => {
    expect(safeHalfWidth(100, 60)).toBeCloseTo(80);
    expect(safeHalfWidth(100, 60)).toBe(safeHalfWidth(100, -60));
  });

  it("is nothing past the edge", () => {
    expect(safeHalfWidth(100, 100)).toBe(0);
    expect(safeHalfWidth(100, 250)).toBe(0);
  });
});

describe("safeLineWidth", () => {
  it("measures at whichever end of the line is nearer the bezel", () => {
    const high = safeLineWidth(480, 60, 40, 0);
    const middle = safeLineWidth(480, 240, 40, 0);
    expect(middle).toBeGreaterThan(high);
  });

  it("keeps the padding off both sides", () => {
    // Measured at the top and bottom edges of the line rather than its middle,
    // so a tall line on the centre row is still a shade narrower than the full
    // diameter.
    const full = 2 * safeHalfWidth(240, 20);
    expect(safeLineWidth(480, 240, 40, 20)).toBeCloseTo(full - 40, 5);
    expect(safeLineWidth(480, 240, 0, 20)).toBeCloseTo(480 - 40, 5);
  });

  it("never goes negative", () => {
    expect(safeLineWidth(480, 2, 40, 20)).toBe(0);
  });
});

describe("centeredBox", () => {
  it("centres the box horizontally", () => {
    for (const size of ROUND_SIZES) {
      const box = centeredBox(size, 200, 40, 300, 8);
      expect(Math.abs(box.x - (size - box.x - box.w))).toBeLessThanOrEqual(1);
    }
  });

  it("never exceeds the width it was asked for", () => {
    const box = centeredBox(480, 240, 40, 120, 8);
    expect(box.w).toBe(120);
  });

  it("keeps all four corners inside the round screen", () => {
    for (const size of ROUND_SIZES) {
      const radius = size / 2;
      for (let top = 10; top < size - 50; top += 7) {
        const box = centeredBox(size, top, 40, size, 4);
        const corners = [
          [box.x, box.y],
          [box.x + box.w, box.y],
          [box.x, box.y + box.h],
          [box.x + box.w, box.y + box.h],
        ];
        for (const [x, y] of corners) {
          const dx = x - radius;
          const dy = y - radius;
          expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThanOrEqual(radius);
        }
      }
    }
  });
});

describe("boxIntersectsScreen", () => {
  it("sees a box in the middle", () => {
    expect(boxIntersectsScreen(480, { x: 200, y: 200, w: 40, h: 40 }, 0)).toBe(true);
  });

  it("sees a box that only overlaps at an edge", () => {
    expect(boxIntersectsScreen(480, { x: -30, y: 200, w: 40, h: 40 }, 0)).toBe(true);
    expect(boxIntersectsScreen(480, { x: 470, y: 200, w: 40, h: 40 }, 0)).toBe(true);
  });

  it("does not see a box that has been panned away", () => {
    expect(boxIntersectsScreen(480, { x: -400, y: 200, w: 40, h: 40 }, 0)).toBe(false);
    expect(boxIntersectsScreen(480, { x: 200, y: 900, w: 40, h: 40 }, 0)).toBe(false);
  });

  it("keeps a margin of slack when asked", () => {
    const box = { x: -60, y: 200, w: 40, h: 40 };
    expect(boxIntersectsScreen(480, box, 0)).toBe(false);
    expect(boxIntersectsScreen(480, box, 40)).toBe(true);
  });
});
