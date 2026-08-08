// The boards on offer, by size.
//
// They are named by size rather than by difficulty because size is what they
// honestly differ in. An independent audit of the shipped collection found that
// a 13x13 needed exactly the same reasoning as a 7x7 - only more of it - so
// labels promising harder *thinking* were promising something the boards did not
// deliver. Bigger boards do turn out to be richer, but that falls out of the
// space being larger, not out of a difficulty knob: the share of boards where the
// no-crossing rule does real work rises from 3 per cent at 7x7 to 55 per cent at
// 13x13, and picking the best of many candidates turns that into a real gradient.
//
// The sizes are chosen against the watch, not against a desktop puzzle book: a
// 7x7 board fits the round screen whole, and the larger ones are meant to be
// panned around. Island counts stay modest because every island is a pair of
// widgets that has to be moved while the map is dragged.

export const LEVELS = [
  {
    id: "7x7",
    oversample: 300,
    cols: 7,
    rows: 7,
    islands: 8,
    minIslands: 7,
    maxSpan: 4,
    doubleShare: 0.35,
    extraBridges: 4,
    attempts: 14,
    maxNodes: 60000,
  },
  {
    id: "9x9",
    oversample: 100,
    cols: 9,
    rows: 9,
    islands: 13,
    minIslands: 11,
    maxSpan: 4,
    doubleShare: 0.35,
    extraBridges: 9,
    attempts: 14,
    maxNodes: 90000,
  },
  {
    id: "11x11",
    oversample: 60,
    cols: 11,
    rows: 11,
    islands: 18,
    minIslands: 15,
    maxSpan: 5,
    doubleShare: 0.35,
    extraBridges: 15,
    attempts: 14,
    maxNodes: 120000,
  },
  {
    id: "13x13",
    oversample: 40,
    cols: 13,
    rows: 13,
    islands: 24,
    minIslands: 20,
    maxSpan: 5,
    doubleShare: 0.35,
    extraBridges: 22,
    attempts: 14,
    maxNodes: 150000,
  },
];

// The most boards to ship for each size - a ceiling the generator aims at, not a
// promise it can meet. The smallest board reaches only about 170: a 7x7 disc
// holds just 57 island layouts on which the no-crossing rule does any real work,
// and padding the rest out with boards that are pure arithmetic would make the
// collection worse, not bigger. The header of each file in boards/ records what
// was actually produced.
// the generator keeps only boards where the game's rules do real work, and the
// smallest board simply does not contain a thousand of those. Whatever it finds
// is what ships, and scripts/generate-boards.mjs prints the count it reached.
export const BOARD_COUNTS = {
  "7x7": 1000,
  "9x9": 700,
  "11x11": 500,
  "13x13": 300,
};

// The fewest of the game's three rules that must actually do work on a board
// before it is worth shipping. Two is what the boards can reach: the connectivity
// rule can only matter on a board that cannot be solved by propagation alone, and
// those are exactly the boards we refuse to ship because they need a guess.
export const MIN_RULES_USED = 2;

export const DEFAULT_LEVEL = 0;

// Clamp a stored or user-supplied level into range; anything unusable falls back
// to the smallest one. Nothing-at-all is checked before the numeric coercion,
// because Number(null) and Number("") are both 0 - which happens to be a valid
// level here, so without this a corrupt value would look like a deliberate one.
export function clampLevel(level) {
  if (level === null || level === undefined || level === "") {
    return DEFAULT_LEVEL;
  }
  const index = Math.floor(Number(level));
  if (!Number.isFinite(index) || index < 0 || index >= LEVELS.length) {
    return DEFAULT_LEVEL;
  }
  return index;
}

// The next level in the cycle, so one button walks through all of them.
export function nextLevel(level) {
  return (clampLevel(level) + 1) % LEVELS.length;
}

export function levelConfig(level) {
  return LEVELS[clampLevel(level)];
}
