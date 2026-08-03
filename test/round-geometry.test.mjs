import { describe, it, expect } from "vitest";
import { centeredBox, clipToScreen, safeHalfWidth, safeLineWidth } from "../lib/round-geometry.js";
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

describe("clipToScreen", () => {
  it("leaves a box that is already on screen alone", () => {
    const box = { x: 100, y: 120, w: 60, h: 40 };
    expect(clipToScreen(480, box)).toEqual(box);
  });

  it("never hands back a negative coordinate", () => {
    for (const box of [
      { x: -50, y: 100, w: 200, h: 10 },
      { x: 100, y: -50, w: 10, h: 200 },
      { x: -20, y: -20, w: 60, h: 60 },
    ]) {
      const clipped = clipToScreen(480, box);
      expect(clipped.x).toBeGreaterThanOrEqual(0);
      expect(clipped.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the part that is on screen, and only that part", () => {
    // A bridge running in from the left keeps its right-hand end exactly where
    // it was, so it still meets the island it belongs to.
    const clipped = clipToScreen(480, { x: -50, y: 100, w: 200, h: 10 });
    expect(clipped).toEqual({ x: 0, y: 100, w: 150, h: 10 });
    expect(clipped.x + clipped.w).toBe(150);
  });

  it("trims a box hanging off the far edge", () => {
    expect(clipToScreen(480, { x: 400, y: 400, w: 200, h: 200 })).toEqual({
      x: 400,
      y: 400,
      w: 80,
      h: 80,
    });
  });

  it("keeps every result inside the screen", () => {
    for (let x = -200; x <= 600; x += 37) {
      for (let y = -200; y <= 600; y += 53) {
        const clipped = clipToScreen(480, { x, y, w: 90, h: 30 });
        if (clipped === null) {
          continue;
        }
        expect(clipped.x).toBeGreaterThanOrEqual(0);
        expect(clipped.y).toBeGreaterThanOrEqual(0);
        expect(clipped.x + clipped.w).toBeLessThanOrEqual(480);
        expect(clipped.y + clipped.h).toBeLessThanOrEqual(480);
        expect(clipped.w).toBeGreaterThan(0);
        expect(clipped.h).toBeGreaterThan(0);
      }
    }
  });

  it("reports nothing for a box that has been panned right off", () => {
    expect(clipToScreen(480, { x: -400, y: 100, w: 40, h: 40 })).toBe(null);
    expect(clipToScreen(480, { x: 100, y: 900, w: 40, h: 40 })).toBe(null);
    expect(clipToScreen(480, { x: 480, y: 100, w: 40, h: 40 })).toBe(null);
  });

  it("reports nothing for a box that only touches the edge", () => {
    // Exactly zero pixels wide once trimmed is nothing to draw, not a sliver.
    expect(clipToScreen(480, { x: -40, y: 100, w: 40, h: 40 })).toBe(null);
    expect(clipToScreen(480, { x: 100, y: -40, w: 40, h: 40 })).toBe(null);
  });
});
