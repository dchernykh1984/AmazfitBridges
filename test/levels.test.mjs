import { describe, it, expect } from "vitest";
import { clampLevel, DEFAULT_LEVEL, LEVELS, levelConfig, nextLevel } from "../lib/levels.js";

describe("the difficulty ladder", () => {
  it("offers several difficulties", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(3);
  });

  it("gets steadily bigger from one level to the next", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].islands).toBeGreaterThan(LEVELS[i - 1].islands);
      expect(LEVELS[i].cols).toBeGreaterThanOrEqual(LEVELS[i - 1].cols);
      expect(LEVELS[i].rows).toBeGreaterThanOrEqual(LEVELS[i - 1].rows);
      expect(LEVELS[i].doubleChance).toBeGreaterThanOrEqual(LEVELS[i - 1].doubleChance);
      expect(LEVELS[i].extraBridges).toBeGreaterThanOrEqual(LEVELS[i - 1].extraBridges);
    }
  });

  it("gives every level a name to look up and a unique id", () => {
    // That the name resolves to a string in every language is checked where the
    // translations are, in test/i18n.test.mjs.
    for (const level of LEVELS) {
      expect(typeof level.label).toBe("string");
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

  it("keeps the chance of a double bridge a probability", () => {
    for (const level of LEVELS) {
      expect(level.doubleChance).toBeGreaterThanOrEqual(0);
      expect(level.doubleChance).toBeLessThanOrEqual(1);
    }
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
