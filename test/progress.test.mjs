import { describe, it, expect } from "vitest";
import {
  bestTimeKey,
  clockSeconds,
  createClock,
  elapsedSeconds,
  formatTime,
  LEVEL_KEY,
  MAX_TIME,
  normalizeCount,
  normalizeTime,
  pauseClock,
  solvedKey,
  startClock,
  updateBestTime,
} from "../lib/progress.js";
import { LEVELS } from "../lib/levels.js";

describe("storage keys", () => {
  it("keeps a separate record for every difficulty", () => {
    const keys = new Set();
    for (let level = 0; level < LEVELS.length; level++) {
      keys.add(bestTimeKey(level));
      keys.add(solvedKey(level));
    }
    keys.add(LEVEL_KEY);
    expect(keys.size).toBe(LEVELS.length * 2 + 1);
  });

  it("is stable, so an update does not lose a player's records", () => {
    expect(LEVEL_KEY).toBe("level");
    expect(bestTimeKey(2)).toBe("best_2");
    expect(solvedKey(2)).toBe("solved_2");
  });
});

describe("normalizeCount", () => {
  it("keeps a sensible count", () => {
    expect(normalizeCount(7)).toBe(7);
    expect(normalizeCount("12")).toBe(12);
  });

  it("reads anything unusable as none", () => {
    expect(normalizeCount(undefined)).toBe(0);
    expect(normalizeCount(null)).toBe(0);
    expect(normalizeCount("rubbish")).toBe(0);
    expect(normalizeCount(-4)).toBe(0);
    expect(normalizeCount(Infinity)).toBe(0);
  });
});

describe("normalizeTime", () => {
  it("keeps a sensible time", () => {
    expect(normalizeTime(125)).toBe(125);
    expect(normalizeTime("60")).toBe(60);
  });

  it("reads anything unusable as no time at all", () => {
    expect(normalizeTime(undefined)).toBe(0);
    expect(normalizeTime(0)).toBe(0);
    expect(normalizeTime(-9)).toBe(0);
    expect(normalizeTime("rubbish")).toBe(0);
  });

  it("caps a board left open overnight at what the clock can show", () => {
    expect(normalizeTime(999999)).toBe(MAX_TIME);
    expect(MAX_TIME).toBe(99 * 60 + 59);
  });
});

describe("updateBestTime", () => {
  it("makes the first finished board a record", () => {
    expect(updateBestTime(0, 90)).toEqual({ best: 90, isRecord: true });
  });

  it("takes a faster time as a new record", () => {
    expect(updateBestTime(90, 75)).toEqual({ best: 75, isRecord: true });
  });

  it("keeps the old record for a slower one", () => {
    expect(updateBestTime(90, 120)).toEqual({ best: 90, isRecord: false });
  });

  it("does not count matching the record as beating it", () => {
    expect(updateBestTime(90, 90)).toEqual({ best: 90, isRecord: false });
  });

  it("never announces a record for a board that was not finished", () => {
    expect(updateBestTime(90, 0)).toEqual({ best: 90, isRecord: false });
    expect(updateBestTime(0, 0)).toEqual({ best: 0, isRecord: false });
  });

  it("recovers from a corrupt stored record", () => {
    expect(updateBestTime("rubbish", 60)).toEqual({ best: 60, isRecord: true });
  });
});

describe("formatTime", () => {
  it("reads as minutes and seconds", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(9)).toBe("00:09");
    expect(formatTime(60)).toBe("01:00");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("keeps the same width as the clock passes ten minutes", () => {
    expect(formatTime(599).length).toBe(formatTime(600).length);
  });

  it("stays inside two digits of minutes", () => {
    expect(formatTime(999999)).toBe("99:59");
  });
});

describe("elapsedSeconds", () => {
  it("counts whole seconds between two clock readings", () => {
    expect(elapsedSeconds(1000, 4500)).toBe(3);
  });

  it("never goes backwards when the watch adjusts its clock", () => {
    expect(elapsedSeconds(5000, 1000)).toBe(0);
    expect(elapsedSeconds(5000, 5000)).toBe(0);
  });

  it("recovers from readings that are not numbers", () => {
    expect(elapsedSeconds(undefined, 1000)).toBe(0);
    expect(elapsedSeconds(1000, null)).toBe(0);
  });
});

describe("the clock", () => {
  it("starts at nothing", () => {
    const clock = createClock();
    expect(clockSeconds(clock, 1000)).toBe(0);
  });

  it("counts once it is running", () => {
    const clock = startClock(createClock(), 1000);
    expect(clockSeconds(clock, 31000)).toBe(30);
  });

  it("stops counting while paused", () => {
    const clock = startClock(createClock(), 1000);
    pauseClock(clock, 11000);
    expect(clockSeconds(clock, 999000)).toBe(10);
  });

  it("picks up where it left off", () => {
    const clock = startClock(createClock(), 1000);
    pauseClock(clock, 11000);
    startClock(clock, 60000);
    expect(clockSeconds(clock, 65000)).toBe(15);
  });

  it("ignores a second start while it is already running", () => {
    const clock = startClock(createClock(), 1000);
    startClock(clock, 50000);
    expect(clockSeconds(clock, 11000)).toBe(10);
  });

  it("ignores a second pause", () => {
    const clock = startClock(createClock(), 1000);
    pauseClock(clock, 11000);
    pauseClock(clock, 99000);
    expect(clockSeconds(clock, 99000)).toBe(10);
  });

  it("caps at what the clock can show", () => {
    const clock = startClock(createClock(), 0);
    expect(clockSeconds(clock, 999999999)).toBe(MAX_TIME);
  });
});
