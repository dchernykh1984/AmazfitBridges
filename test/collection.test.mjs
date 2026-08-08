import { describe, it, expect } from "vitest";
import {
  allSeen,
  dealBoard,
  decodeSeen,
  emptySeen,
  encodeSeen,
  markSeen,
  seenCount,
  seenKey,
} from "../lib/collection.js";
import { createRandom } from "../lib/rng.js";
import { BOARD_COUNTS, LEVELS } from "../lib/levels.js";

const always = (value) => () => value;

describe("emptySeen", () => {
  it("starts with nothing played", () => {
    expect(emptySeen(5)).toEqual([false, false, false, false, false]);
    expect(seenCount(emptySeen(5))).toBe(0);
    expect(allSeen(emptySeen(5))).toBe(false);
  });

  it("copes with a silly size", () => {
    expect(emptySeen(0)).toEqual([]);
    expect(emptySeen(-3)).toEqual([]);
  });

  it("is never 'all seen' when there is nothing to see", () => {
    expect(allSeen([])).toBe(false);
  });
});

describe("encodeSeen and decodeSeen", () => {
  it("round-trips", () => {
    const seen = [true, false, true, true, false, false, true];
    expect(decodeSeen(encodeSeen(seen), seen.length)).toEqual(seen);
  });

  it("round-trips every board of a real collection", () => {
    const seen = emptySeen(BOARD_COUNTS[LEVELS[0].id]);
    for (let i = 0; i < seen.length; i += 7) {
      seen[i] = true;
    }
    expect(decodeSeen(encodeSeen(seen), seen.length)).toEqual(seen);
  });

  it("packs four boards into each character", () => {
    expect(encodeSeen(emptySeen(1000)).length).toBe(250);
  });

  it("reads a record of the wrong length as a fresh start", () => {
    // The collection grew or shrank between app versions, so the old bits no
    // longer mean what they meant. Better a clean slate than boards silently
    // marked as played that never were.
    expect(decodeSeen("ff", 100)).toEqual(emptySeen(100));
  });

  it("reads a corrupt record as a fresh start", () => {
    expect(decodeSeen("zz", 8)).toEqual(emptySeen(8));
    expect(decodeSeen(null, 8)).toEqual(emptySeen(8));
    expect(decodeSeen(undefined, 8)).toEqual(emptySeen(8));
    expect(decodeSeen(12345, 8)).toEqual(emptySeen(8));
  });

  it("keeps the tail bits of a size that is not a multiple of four", () => {
    const seen = [false, false, false, false, true];
    expect(decodeSeen(encodeSeen(seen), 5)).toEqual(seen);
  });
});

describe("markSeen", () => {
  it("marks a board without touching the old record", () => {
    const before = emptySeen(3);
    const after = markSeen(before, 1);
    expect(after).toEqual([false, true, false]);
    expect(before).toEqual([false, false, false]);
  });

  it("ignores an index that is not there", () => {
    expect(markSeen(emptySeen(3), 9)).toEqual([false, false, false]);
    expect(markSeen(emptySeen(3), -1)).toEqual([false, false, false]);
  });
});

describe("dealBoard", () => {
  it("deals a board from the pool", () => {
    const { index, wrapped } = dealBoard(emptySeen(10), always(0.5), -1);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(10);
    expect(wrapped).toBe(false);
  });

  it("starts where the roll points", () => {
    expect(dealBoard(emptySeen(10), always(0), -1).index).toBe(0);
    expect(dealBoard(emptySeen(10), always(0.99), -1).index).toBe(9);
  });

  it("never deals a board that has been played", () => {
    let seen = emptySeen(20);
    const random = createRandom(7);
    const dealt = [];
    for (let i = 0; i < 20; i++) {
      const result = dealBoard(seen, random, -1);
      expect(result.wrapped, `deal ${i}`).toBe(false);
      expect(dealt).not.toContain(result.index);
      dealt.push(result.index);
      seen = markSeen(result.seen, result.index);
    }
    expect(dealt.sort((a, b) => a - b)).toEqual([...Array(20).keys()]);
  });

  it("walks forward to the next unplayed board when the roll lands on a played one", () => {
    const seen = [true, true, false, false];
    expect(dealBoard(seen, always(0), -1).index).toBe(2);
  });

  it("wraps around the end of the pool", () => {
    const seen = [false, true, true, true];
    expect(dealBoard(seen, always(0.99), -1).index).toBe(0);
  });

  it("wipes the slate once every board has been played", () => {
    const seen = [true, true, true];
    const result = dealBoard(seen, always(0), -1);
    expect(result.wrapped).toBe(true);
    expect(seenCount(result.seen)).toBe(0);
    expect(result.index).toBeGreaterThanOrEqual(0);
  });

  it("does not hand back the very board just finished after a wipe", () => {
    // Finishing a whole collection and being given the same board again would
    // read as a bug, however small the odds.
    for (let roll = 0; roll < 10; roll++) {
      const result = dealBoard([true, true, true], always(roll / 10), 0);
      expect(result.wrapped).toBe(true);
      expect(result.index).not.toBe(0);
    }
  });

  it("has no choice but to repeat when the pool holds one board", () => {
    const result = dealBoard([true], always(0), 0);
    expect(result.index).toBe(0);
    expect(result.wrapped).toBe(true);
  });

  it("only avoids a board on the round that wrapped", () => {
    // Mid-collection there is no reason to steer away from anything.
    expect(dealBoard([false], always(0), 0).index).toBe(0);
  });

  it("deals nothing from an empty pool", () => {
    expect(dealBoard([], always(0), -1)).toEqual({ index: -1, seen: [], wrapped: false });
  });

  it("survives a random source that returns nonsense", () => {
    for (const roll of [-1, 1, 1.5, NaN]) {
      const result = dealBoard(emptySeen(5), always(roll), -1);
      expect(result.index, String(roll)).toBeGreaterThanOrEqual(0);
      expect(result.index, String(roll)).toBeLessThan(5);
    }
  });

  it("keeps dealing for ever, resetting each time the pool runs dry", () => {
    let seen = emptySeen(6);
    const random = createRandom(3);
    let wraps = 0;
    let last = -1;
    for (let i = 0; i < 60; i++) {
      const result = dealBoard(seen, random, last);
      expect(result.index).toBeGreaterThanOrEqual(0);
      if (result.wrapped) {
        wraps += 1;
      }
      last = result.index;
      seen = markSeen(result.seen, result.index);
    }
    expect(wraps).toBe(9);
  });
});

describe("seenKey", () => {
  it("keeps a separate record for every difficulty", () => {
    const keys = new Set(LEVELS.map((level) => seenKey(level.id)));
    expect(keys.size).toBe(LEVELS.length);
  });

  it("is stable, so an update does not forget what a player has played", () => {
    expect(seenKey("9x9")).toBe("seen_9x9");
  });
});
