// What the watch remembers between games: the size last played, how many
// boards have been solved at each one, and the fastest time. Pure, so the
// storage contract is unit tested; the page owns the actual LocalStorage handle
// and this module owns the key names and the "is this a record" decision.

// Where the last chosen size is remembered, so the game reopens the way it
// was left.
export const LEVEL_KEY = "level";

const BEST_TIME_PREFIX = "best_";
const SOLVED_PREFIX = "solved_";

// A record is kept per size AND per source. Beating your time on a 13x13 says
// something very different from beating it on a 7x7, and a board dealt from the
// collection is a different proposition from one the watch rolled on the spot -
// the collection never repeats itself, so working through it is a run rather
// than a series of unrelated attempts.
export function bestTimeKey(level, source) {
  return BEST_TIME_PREFIX + source + "_" + level;
}

export function solvedKey(level, source) {
  return SOLVED_PREFIX + source + "_" + level;
}

// The keys used before boards had a source. Everything the app had played until
// then was generated on the watch, so those records belong to the generated
// side; the page reads them when the new key has nothing, which carries a
// player's history across the update without a migration step that could fail
// halfway.
export function legacyBestTimeKey(level) {
  return BEST_TIME_PREFIX + level;
}

export function legacySolvedKey(level) {
  return SOLVED_PREFIX + level;
}

// A stored value coerced to a usable count. Storage can hand back a string, null
// or leftover junk from an older build; none of that may crash the game or show
// up on screen, so anything unusable reads as zero.
export function normalizeCount(value) {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }
  return count;
}

// Seconds, rounded and clamped to what the clock can show. A board left open
// overnight should read as a very slow game, not as a number that overflows the
// box it is drawn in.
export const MAX_TIME = 99 * 60 + 59;

export function normalizeTime(value) {
  const seconds = Math.floor(Number(value));
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.min(MAX_TIME, seconds);
}

// The best time after a finished board, and whether it is a new record. Zero
// means "never finished one", so the first solve is always a record and an
// unfinished board never sets one.
export function updateBestTime(previousBest, seconds) {
  const best = normalizeTime(previousBest);
  const final = normalizeTime(seconds);
  if (final > 0 && (best === 0 || final < best)) {
    return { best: final, isRecord: true };
  }
  return { best, isRecord: false };
}

// mm:ss, with the minutes never shrinking below two digits so the readout does
// not jump about as the clock passes ten minutes. Zero (no record yet) has no
// sensible clock face, so the caller is told to show a dash instead.
export function formatTime(seconds) {
  const total = normalizeTime(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return (minutes < 10 ? "0" : "") + minutes + ":" + (rest < 10 ? "0" : "") + rest;
}

// The elapsed seconds between two millisecond clock readings, floored at zero
// so a watch that adjusts its clock mid-game cannot produce a negative time.
export function elapsedSeconds(startedAt, now) {
  const start = Number(startedAt);
  const end = Number(now);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  return Math.min(MAX_TIME, Math.floor((end - start) / 1000));
}

// A stopwatch that survives being paused. Thinking time counts, but time spent
// staring at the pause menu does not, so the clock banks what has run so far and
// starts a fresh segment on each resume.
export function createClock() {
  return { banked: 0, since: null };
}

export function startClock(clock, now) {
  if (clock.since === null) {
    clock.since = now;
  }
  return clock;
}

export function pauseClock(clock, now) {
  if (clock.since !== null) {
    clock.banked += elapsedSeconds(clock.since, now);
    clock.since = null;
  }
  return clock;
}

export function clockSeconds(clock, now) {
  const running = clock.since === null ? 0 : elapsedSeconds(clock.since, now);
  return Math.min(MAX_TIME, clock.banked + running);
}
