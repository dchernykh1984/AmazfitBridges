// Dealing boards out of the built-in collection without repeating one until the
// whole pool has been played.
//
// What has been seen is a bit per board, written to storage as hex - a thousand
// boards is two hundred and fifty characters, which a watch can keep without
// noticing. Pure, so the wrap-around and the awkward sizes are unit tested
// rather than discovered a year into playing.

const BITS_PER_CHAR = 4;

export function emptySeen(count) {
  return new Array(Math.max(0, Math.floor(count))).fill(false);
}

// A stored hex string back into one flag per board. Anything unreadable, or a
// record written when the collection was a different size, reads as "nothing
// seen yet": losing the history is a far smaller harm than refusing to deal.
export function decodeSeen(text, count) {
  const size = Math.max(0, Math.floor(count));
  const seen = emptySeen(size);
  if (typeof text !== "string" || text.length !== Math.ceil(size / BITS_PER_CHAR)) {
    return seen;
  }

  for (let index = 0; index < size; index++) {
    const digit = parseInt(text[Math.floor(index / BITS_PER_CHAR)], 16);
    if (!Number.isInteger(digit)) {
      return emptySeen(size);
    }
    seen[index] = (digit & (1 << (index % BITS_PER_CHAR))) !== 0;
  }
  return seen;
}

export function encodeSeen(seen) {
  let text = "";
  for (let start = 0; start < seen.length; start += BITS_PER_CHAR) {
    let digit = 0;
    for (let bit = 0; bit < BITS_PER_CHAR; bit++) {
      if (seen[start + bit]) {
        digit |= 1 << bit;
      }
    }
    text += digit.toString(16);
  }
  return text;
}

export function seenCount(seen) {
  let count = 0;
  for (let i = 0; i < seen.length; i++) {
    if (seen[i]) {
      count += 1;
    }
  }
  return count;
}

export function allSeen(seen) {
  return seen.length > 0 && seenCount(seen) === seen.length;
}

// Mark a board as played. Returns a new array so the caller can keep the old one
// if the deal that followed did not stick.
export function markSeen(seen, index) {
  const next = seen.slice();
  if (index >= 0 && index < next.length) {
    next[index] = true;
  }
  return next;
}

// Deal the next board.
//
// Rolls a random starting point and walks forward to the first board that has
// not been played, which spreads the choice over the whole pool rather than
// favouring the front of it. When every board has been played the slate is wiped
// and the deal starts again - and the board just finished is skipped in that
// fresh round, so the reward for completing a collection is never the very same
// board again.
//
// Returns `{ index, seen, wrapped }`. `index` is -1 only when there is nothing
// to deal at all.
export function dealBoard(seen, random, avoid) {
  const count = seen.length;
  if (count === 0) {
    return { index: -1, seen, wrapped: false };
  }

  let pool = seen;
  let wrapped = false;
  if (allSeen(pool)) {
    pool = emptySeen(count);
    wrapped = true;
  }

  const skip = wrapped && count > 1 ? avoid : -1;
  // Math.max(0, NaN) is NaN, so a random source that hands back nonsense has to
  // be caught before the clamp rather than by it.
  const roll = Number(random());
  const start = Number.isFinite(roll)
    ? Math.min(count - 1, Math.max(0, Math.floor(roll * count)))
    : 0;

  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    if (!pool[index] && index !== skip) {
      return { index, seen: pool, wrapped };
    }
  }

  // Only reachable when the one board left is the one we were told to skip.
  for (let index = 0; index < count; index++) {
    if (!pool[index]) {
      return { index, seen: pool, wrapped };
    }
  }
  return { index: -1, seen: pool, wrapped };
}

// Where the played-board record for a size is kept. Built-in boards only:
// a board the watch generated on the spot is gone the moment it is solved, so
// there is nothing to remember about it.
export function seenKey(levelId) {
  return "seen_" + levelId;
}
