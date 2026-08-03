// A small seeded pseudo-random generator. The puzzle generator has to be
// reproducible so a failing board can be replayed from its seed in a unit test,
// and Math.random cannot do that. mulberry32 is a well-known 32-bit generator:
// one multiply-xor round per call, no state beyond a single integer, and a
// period long enough for the few thousand draws one puzzle needs.

// Coerce anything (a stored string, undefined, a float) into a usable 32-bit
// seed. Zero is a legal mulberry32 state, so no value needs rejecting - but a
// non-numeric one must not turn the generator into a NaN pump.
export function normalizeSeed(seed) {
  const value = Math.floor(Number(seed));
  if (!Number.isFinite(value)) {
    return 1;
  }
  return value >>> 0;
}

// A function returning the next float in [0, 1).
export function createRandom(seed) {
  let state = normalizeSeed(seed);
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A whole number in [0, bound). Returns 0 for a bound that cannot produce one,
// so a caller that lost track of an empty range indexes harmlessly instead of
// producing NaN.
export function randomInt(random, bound) {
  const limit = Math.floor(bound);
  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }
  return Math.min(limit - 1, Math.floor(random() * limit));
}

// A uniformly chosen element, or null for an empty list.
export function pick(random, items) {
  if (items.length === 0) {
    return null;
  }
  return items[randomInt(random, items.length)];
}

// A shuffled copy (Fisher-Yates). The input is left alone so a caller can keep
// iterating the original order.
export function shuffle(random, items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1);
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}
