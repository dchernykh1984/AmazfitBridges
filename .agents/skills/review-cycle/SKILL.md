---
name: review-cycle
description: Run the review cycles this repository expects over a branch - re-read the whole diff, fix what is found as its own commit, and know when to stop. Use when asked for N review cycles, a review pass with fixes, or a review of a branch before opening a pull request.
---

# Review cycles

A review cycle here means: read the whole diff of the branch again with fresh eyes,
find real problems, and **commit the fixes as their own commit** rather than
folding them into the change under review. The history should show what was found
and when - `fix: name an island-free grid as empty rather than as a duplicate` and
`docs: repair a comment and a count left over from the first review pass` are both
review-cycle commits.

## What a cycle is

1. `git diff main...HEAD` over the source, then over the tests. Read the whole
   diff, not the parts you remember writing.
2. Judge each finding: would this actually produce a wrong result, an unsolvable or
   ambiguous board, a crash, an unreadable screen, or a silent gap in the tests? A
   rename you would have made differently is not a finding.
3. Fix what survives, one commit per cycle, with a message naming what was found.
4. `npm test`, `npm run lint`, `npm run format:check` before the commit; add
   `npm run boards:check` if anything under the rules, the solver or `boards/`
   moved.

**Stop early when a cycle stops finding anything serious.** Five requested cycles
that turn up nothing after the second are two cycles; say so rather than inventing
findings to fill the count.

## What is worth looking for here

- **A claim about boards that the collection does not support.** The generator,
  `lib/board-quality.js` and the README all describe the same gates; when one moves,
  the other two go stale. Counts in prose are the first thing to rot - check them
  against the headers in `boards/*.txt`.
- **A solver or generator change that weakens a guarantee.** Every shipped board
  has exactly one solution, reachable without guessing, and uses at least two of
  the game's rules (`MIN_RULES_USED` in `lib/levels.js`). If a change could let a
  board through that fails any of those, `npm run boards:check` is the answer, not
  an opinion.
- **Geometry that only holds at one screen size.** The bundle ships 466 and 480.
  Anything positioned with a bare number in `page/index.js` belongs in
  `lib/board-geometry.js`, `lib/camera.js` or `lib/hud.js`, where a test can put
  both sizes through it. Anything drawn near the top or bottom has to be cut to the
  chord at its own height (`lib/round-geometry.js`) or it hangs over the bezel.
- **Text that can outgrow its box.** Zepp text widgets clip rather than wrap.
  Compare the room a line has against the longest form of that line across all 11
  tables in `lib/i18n/labels.js`, not against English, and against the budget
  `budgetFor` gives its key.
- **Tap routing.** Every touch goes through the one transparent layer above the
  widgets and is resolved by `lib/hud.js` and `lib/board-geometry.js`. A new
  control that is hit-tested anywhere else will work until a drag starts on it.
- **State that survives a screen change.** Changing the size or the source has to
  forget the dealt board; the pause clock has to stop and restart with the menu.
  Ask which screens can reach the state a change touches.
- **Storage.** Reads must survive a watch with no storage, a failing storage, and a
  storage holding nonsense or the pre-source key names from an older build
  (`lib/progress.js` keeps the legacy keys for exactly that). The session copy is
  authoritative over what is on the disk.
- **Two sources of truth.** A count in the page and the same count in a module, a
  key in `keys.js` and its use in a table, a board count in `lib/levels.js` and the
  header of the file in `boards/` - if they can disagree, either join them or add
  the test that fails when they do.
- **Tests that pass for the wrong reason.** A fixture that happens to solve, an
  assertion on a hard-coded board code, a random test with no seed: `lib/rng.js`
  exists so that every generated case is reproducible.

## What a finding is not

Do not report style preferences, do not re-litigate a decision the person already
made, and do not raise a defensive check for a case the data model makes
impossible - a rejected counter that nothing reports was removed in review for
exactly that reason. If a cycle found nothing, the honest report is that it found
nothing.
