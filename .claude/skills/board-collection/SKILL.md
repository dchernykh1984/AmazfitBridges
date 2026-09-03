---
name: board-collection
description: Regenerate, repack and re-prove the built-in board collection in boards/ and lib/boards.js. Use when asked to change the boards, add or drop a size, rebuild the collection after a generator or rules change, or check that every shipped board is still valid.
---

# The built-in board collection

Two files per size, and they must never disagree:

```
boards/<size>.txt   the source of truth - readable grids, reviewed in a diff
lib/boards.js       generated from them, committed, and what the watch imports
```

`lib/boards.js` is committed rather than built, so no build can produce a bundle
with no boards in it. `test/boards.test.mjs` re-packs the grids and compares, so a
hand edit to either one fails the tests. **Never edit either file by hand.**

## The three commands

```bash
npm run boards        # regenerate every size from the generator (a few minutes)
npm run pack          # compile boards/*.txt into lib/boards.js (instant)
npm run boards:check  # re-prove every shipped board (a few seconds)
```

`npm run boards` takes arguments for a single size while iterating:

```bash
npm run boards -- --level 9x9 --count 50
npm run boards -- --level 13x13 --oversample 10   # rough and fast, for a smoke test
```

It prints, per size, how many boards were kept out of how many candidates, how many
distinct shapes they use, and the 3/2/1/0 split of how many of the game's rules
each board makes a solver use. That line is the review: a collection whose split
has drifted towards 1 and 0 is a worse collection, whatever the count says.

The seed is fixed (`BASE_SEED` in the script), so the same inputs reproduce the same
collection exactly. Regenerating with no change to the generator should produce no
diff at all.

## Changing the boards

Change the generator, not the files.

- `lib/generator.js` builds a board by construction and proves it.
- `lib/board-quality.js` decides what "a good board" means: it switches each rule
  off in the solver and sees whether the answer stops being unique.
- `lib/levels.js` holds the sizes, the island counts, the oversample factors,
  `BOARD_COUNTS` (a ceiling the generator aims at, not a promise) and
  `MIN_RULES_USED`.

Then, in this order: `npm run boards`, `npm run pack`, `npm run boards:check`,
`npm test`. Commit `boards/`, `lib/boards.js` and the generator change together -
they are one change, and a commit with only two of the three leaves the tests red.

The counts in `README.md` and the header of each file in `boards/` are part of the
change. A count that no longer matches the collection has been a review finding
more than once.

## The gates every shipped board clears

Stated once, because a change that quietly drops one of them is the failure mode
this whole pipeline exists to prevent:

- exactly one solution;
- that solution reachable by deduction alone, never by guessing;
- every island inside the round playfield (`lib/playfield.js`);
- islands spread across the board, with no empty quadrant;
- no duplicate: not the same layout-and-numbers at all, and not the same shape more
  than three times;
- at least `MIN_RULES_USED` of the game's three rules doing real work.

`npm run boards:check` walks the whole collection against these; the unit tests
prove a sample on every run. After any change to `lib/puzzle.js`, `lib/solver.js`
or `lib/playfield.js`, run the full check even if the boards themselves did not
move - the rules moved under them.

## The on-watch generator is a different thing

`Random` boards are built on the wrist by the same `lib/generator.js`, but to a
time budget: `attempts` in `lib/levels.js` (14) bounds the tries, and if none can be
proved it plays the last valid board anyway rather than leaving the screen empty.
Only the built-in collection is proved without exception. Say so plainly in any
text that compares the two.
