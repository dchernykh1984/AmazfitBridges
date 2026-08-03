import { describe, it, expect } from "vitest";
import { createRandom, normalizeSeed, pick, randomInt, shuffle } from "../lib/rng.js";

function draw(random, count) {
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push(random());
  }
  return values;
}

describe("normalizeSeed", () => {
  it("keeps a whole number as an unsigned 32-bit value", () => {
    expect(normalizeSeed(0)).toBe(0);
    expect(normalizeSeed(12345)).toBe(12345);
    expect(normalizeSeed(-1)).toBe(4294967295);
  });

  it("survives anything that is not a number", () => {
    expect(normalizeSeed(undefined)).toBe(1);
    expect(normalizeSeed(null)).toBe(0);
    expect(normalizeSeed("nonsense")).toBe(1);
    expect(normalizeSeed(Infinity)).toBe(1);
  });

  it("accepts a float by flooring it", () => {
    expect(normalizeSeed(7.9)).toBe(7);
  });
});

describe("createRandom", () => {
  it("is reproducible: the same seed gives the same sequence", () => {
    expect(draw(createRandom(42), 50)).toEqual(draw(createRandom(42), 50));
  });

  it("gives different seeds different sequences", () => {
    expect(draw(createRandom(1), 20)).not.toEqual(draw(createRandom(2), 20));
  });

  it("stays inside [0, 1)", () => {
    const random = createRandom(999);
    for (const value of draw(random, 2000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("spreads values over the whole range", () => {
    const buckets = new Array(10).fill(0);
    const random = createRandom(7);
    for (const value of draw(random, 10000)) {
      buckets[Math.floor(value * 10)] += 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(700);
    }
  });
});

describe("randomInt", () => {
  it("stays inside [0, bound)", () => {
    const random = createRandom(3);
    for (let i = 0; i < 1000; i++) {
      const value = randomInt(random, 7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it("reaches both ends of the range", () => {
    const random = createRandom(11);
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      seen.add(randomInt(random, 4));
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("answers zero for a range that cannot produce anything", () => {
    const random = createRandom(1);
    expect(randomInt(random, 0)).toBe(0);
    expect(randomInt(random, -5)).toBe(0);
    expect(randomInt(random, NaN)).toBe(0);
  });
});

describe("pick", () => {
  it("returns an element of the list", () => {
    const random = createRandom(5);
    const items = ["a", "b", "c"];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(pick(random, items));
    }
  });

  it("returns null for an empty list", () => {
    expect(pick(createRandom(5), [])).toBe(null);
  });
});

describe("shuffle", () => {
  it("returns a permutation of the input", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffle(createRandom(21), items);
    expect(shuffled.length).toBe(items.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it("leaves the input alone", () => {
    const items = [1, 2, 3, 4, 5];
    shuffle(createRandom(21), items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it("actually reorders things", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let reordered = 0;
    for (let seed = 0; seed < 20; seed++) {
      if (shuffle(createRandom(seed), items).join() !== items.join()) {
        reordered += 1;
      }
    }
    expect(reordered).toBeGreaterThan(15);
  });

  it("is reproducible from a seed", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffle(createRandom(8), items)).toEqual(shuffle(createRandom(8), items));
  });
});
