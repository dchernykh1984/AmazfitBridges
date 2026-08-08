// Every string the watch screen can show, as a key. This is the contract each
// language table must satisfy: the locale-completeness unit test fails if a
// table is missing a key or carries one that is not here.
export const UI_KEYS = [
  "title",
  "play",
  "source_builtin",
  "source_random",
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
// auto-shrinking, so a label that overruns its box is simply clipped.
//
// Three widths exist on screen, so there are three budgets. The action bar under
// a board splits one chord between two buttons, which makes those the narrowest
// labels in the app; the menu buttons run most of the way across; and the hints,
// the status lines and the "generating" notice are full-width lines of their own.
export const MAX_ACTION = 10;
export const MAX_LABEL = 12;
export const MAX_HINT = 20;

export const ACTION_KEYS = ["undo", "menu"];
export const LONG_KEYS = ["generating", "well_done", "new_best", "hint_tap", "hint_drag"];

export function budgetFor(key) {
  if (ACTION_KEYS.indexOf(key) !== -1) {
    return MAX_ACTION;
  }
  return LONG_KEYS.indexOf(key) === -1 ? MAX_LABEL : MAX_HINT;
}
