import { describe, it, expect } from "vitest";
import { clampLevel, DEFAULT_LEVEL, LEVELS, levelConfig, nextLevel } from "../lib/levels.js";

describe("the sizes on offer", () => {
  it("offers several sizes", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(3);
  });

  it("gets steadily bigger from one level to the next", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].islands).toBeGreaterThan(LEVELS[i - 1].islands);
      expect(LEVELS[i].cols).toBeGreaterThanOrEqual(LEVELS[i - 1].cols);
      expect(LEVELS[i].rows).toBeGreaterThanOrEqual(LEVELS[i - 1].rows);
      expect(LEVELS[i].extraBridges).toBeGreaterThanOrEqual(LEVELS[i - 1].extraBridges);
    }
  });

  it("names every size by its own dimensions, and uniquely", () => {
    // The id is what the start-screen button shows. It reads the same in every
    // language, which is why there is no translation for it.
    for (const level of LEVELS) {
      expect(level.id).toBe(`${level.cols}x${level.rows}`);
    }
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
  });

  it("asks for island counts a board of that size can hold", () => {
    for (const level of LEVELS) {
      // Islands may not touch, so a grid holds at most about half its cells.
      expect(level.islands).toBeLessThan((level.cols * level.rows) / 2);
      expect(level.minIslands).toBeGreaterThan(0);
      expect(level.minIslands).toBeLessThanOrEqual(level.islands);
    }
  });

  it("leaves room to draw a bridge at every span it allows", () => {
    for (const level of LEVELS) {
      expect(level.maxSpan).toBeGreaterThanOrEqual(2);
      expect(level.maxSpan).toBeLessThan(Math.min(level.cols, level.rows));
    }
  });

  it("gives the generator a retry budget and a thinking budget", () => {
    for (const level of LEVELS) {
      expect(level.attempts).toBeGreaterThan(1);
      expect(level.maxNodes).toBeGreaterThan(1000);
    }
  });

  it("keeps the share of double bridges a proportion", () => {
    for (const level of LEVELS) {
      expect(level.doubleShare).toBeGreaterThanOrEqual(0);
      expect(level.doubleShare).toBeLessThanOrEqual(1);
    }
  });

  it("samples far more candidates than it keeps, so the best can be picked", () => {
    for (const level of LEVELS) {
      expect(level.oversample, level.id).toBeGreaterThan(1);
    }
    // The smallest board has the poorest candidate pool, so it needs to look
    // through the most to find boards where the rules do any work.
    expect(LEVELS[0].oversample).toBeGreaterThan(LEVELS[LEVELS.length - 1].oversample);
  });
});

describe("clampLevel", () => {
  it("keeps a level that is already in range", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(clampLevel(i)).toBe(i);
    }
  });

  it("reads a stored string back as a level", () => {
    expect(clampLevel("2")).toBe(2);
  });

  it("falls back to the default for anything unusable", () => {
    expect(clampLevel(null)).toBe(DEFAULT_LEVEL);
    expect(clampLevel(undefined)).toBe(DEFAULT_LEVEL);
    expect(clampLevel("")).toBe(DEFAULT_LEVEL);
    expect(clampLevel("nonsense")).toBe(DEFAULT_LEVEL);
    expect(clampLevel(-1)).toBe(DEFAULT_LEVEL);
    expect(clampLevel(LEVELS.length)).toBe(DEFAULT_LEVEL);
  });

  it("tells a fresh install apart from a stored zero", () => {
    // Number(null) and Number("") are both 0, which is a real level here.
    expect(clampLevel(0)).toBe(0);
    expect(DEFAULT_LEVEL).toBe(0);
  });
});

describe("nextLevel", () => {
  it("walks through every level and comes back round", () => {
    let level = 0;
    const seen = [level];
    for (let i = 1; i < LEVELS.length; i++) {
      level = nextLevel(level);
      seen.push(level);
    }
    expect(seen.sort()).toEqual(LEVELS.map((_, i) => i));
    expect(nextLevel(LEVELS.length - 1)).toBe(0);
  });

  it("recovers from a corrupt level", () => {
    expect(nextLevel("nonsense")).toBe(DEFAULT_LEVEL + 1);
  });
});

describe("levelConfig", () => {
  it("hands back the settings for a level", () => {
    expect(levelConfig(1)).toBe(LEVELS[1]);
  });

  it("falls back rather than handing back nothing", () => {
    expect(levelConfig(999)).toBe(LEVELS[DEFAULT_LEVEL]);
  });
});
