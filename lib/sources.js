// Where a board comes from.
//
// The app ships a collection of boards that were generated on a computer
// and put through the solver twice, which is how it can promise every one of
// them has a single answer reachable without guessing. It can also build one on
// the wrist, which nobody needs for quality - but a board nobody has ever seen
// is worth something on its own, so the choice stays with the player.
//
// The two are kept apart for records: a board from the collection is dealt from
// a pool that never repeats, while a generated one is a fresh roll every time,
// and one best time covering both would mean neither.

export const BUILT_IN = "builtin";
export const GENERATED = "generated";

export const SOURCES = [BUILT_IN, GENERATED];

// Built-in first: it is the better experience, so it is what a fresh install
// gets without being asked.
export const DEFAULT_SOURCE = BUILT_IN;

// Where the chosen source is remembered.
export const SOURCE_KEY = "source";

export function clampSource(source) {
  return SOURCES.indexOf(source) === -1 ? DEFAULT_SOURCE : source;
}

export function nextSource(source) {
  const at = SOURCES.indexOf(clampSource(source));
  return SOURCES[(at + 1) % SOURCES.length];
}

// The i18n key naming this source on the start screen.
export function sourceLabel(source) {
  return clampSource(source) === BUILT_IN ? "source_builtin" : "source_random";
}
