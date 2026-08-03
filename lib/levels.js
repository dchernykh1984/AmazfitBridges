// The difficulty ladder. Each level is a board size, how many islands to aim
// for, and how aggressively the generator should double bridges and close
// loops - the three knobs that actually decide how hard a Hashiwokakero board
// plays. Pure data, so the shape of the ladder is unit tested rather than
// discovered on the wrist.
//
// The sizes are chosen against the watch, not against a desktop puzzle book: a
// 7x7 board fits the round screen whole, and the larger ones are meant to be
// panned around. Island counts stay modest because every island is a pair of
// widgets that has to be moved while the map is dragged.

export const LEVELS = [
  {
    id: "easy",
    label: "level_easy",
    cols: 7,
    rows: 7,
    islands: 8,
    minIslands: 7,
    maxSpan: 4,
    doubleChance: 0.25,
    extraBridges: 4,
    attempts: 14,
    maxNodes: 60000,
  },
  {
    id: "medium",
    label: "level_medium",
    cols: 9,
    rows: 9,
    islands: 13,
    minIslands: 11,
    maxSpan: 4,
    doubleChance: 0.35,
    extraBridges: 9,
    attempts: 14,
    maxNodes: 90000,
  },
  {
    id: "hard",
    label: "level_hard",
    cols: 11,
    rows: 11,
    islands: 18,
    minIslands: 15,
    maxSpan: 5,
    doubleChance: 0.45,
    extraBridges: 15,
    attempts: 14,
    maxNodes: 120000,
  },
  {
    id: "expert",
    label: "level_expert",
    cols: 13,
    rows: 13,
    islands: 24,
    minIslands: 20,
    maxSpan: 5,
    doubleChance: 0.5,
    extraBridges: 22,
    attempts: 14,
    maxNodes: 150000,
  },
];

export const DEFAULT_LEVEL = 0;

// Clamp a stored or user-supplied level into range; anything unusable falls back
// to the easiest one. Nothing-at-all is checked before the numeric coercion,
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
