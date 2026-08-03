// Every string the watch screen can show, as a key. This is the contract each
// language table must satisfy: the locale-completeness unit test fails if a
// table is missing a key or carries one that is not here.
export const UI_KEYS = [
  "title",
  "play",
  "difficulty",
  "level_easy",
  "level_medium",
  "level_hard",
  "level_expert",
  "best",
  "solved",
  "time",
  "undo",
  "menu",
  "paused",
  "resume",
  "restart",
  "quit",
  "again",
  "generating",
  "well_done",
  "new_best",
  "hint_tap",
  "hint_drag",
];

// The on-watch character budgets. Everything is drawn on a round screen with no
// auto-shrinking, so a label that overruns its box is simply clipped. Most keys
// sit on a button and get the short budget; the hints, the status lines and the
// "generating" notice are full-width lines of their own and get a wider one.
export const MAX_LABEL = 12;
export const MAX_HINT = 20;
export const LONG_KEYS = ["generating", "well_done", "new_best", "hint_tap", "hint_drag"];

export function budgetFor(key) {
  return LONG_KEYS.indexOf(key) === -1 ? MAX_LABEL : MAX_HINT;
}
