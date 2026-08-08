# Amazfit Bridges

**Island Bridges** is Hashiwokakero ("build bridges") as a **Zepp OS mini app** for round
Amazfit watches.

Islands carry a number. Join them with bridges until every island has exactly as many
bridge ends as its number, and every island is part of one connected network.

The repository is named `AmazfitBridges`; **Island Bridges** is the name the app is
registered under in the Zepp App Store.

## The rules

- Bridges run only **horizontally or vertically**, in a straight line between two islands
  with nothing in between.
- At most **two** bridges join the same pair.
- Bridges **never cross** each other or an island.
- Every island ends up with **exactly its number** of bridge ends.
- All the bridges together join **every island into a single group** - this last one is
  what turns an arithmetic exercise into a puzzle.

Every board the game deals has **exactly one answer**, and that answer can always be
reached by deduction alone: you never have to guess and see what happens. Both properties
are checked by the solver before a board is shown (`lib/solver.js`), and both are covered
by the tests.

## Playing it on the wrist

- **Tap an island** to pick it up. The lanes it can still build along light up.
- **Tap one of its neighbours** to cycle the bridge between them: one, two, none.
- **Tap a bridge** to change it without picking anything up first.
- **Tap the water** to put the selected island down again.
- **Drag anywhere** to move the map, the way a map moves in a navigator. Boards are bigger
  than the screen, and a round screen cuts the corners off a square board, so dragging is
  how you see the rest of it.
- An island turns **green** when it has all the bridges it needs, and lets go of the
  selection on its own so the next tap is free for somewhere else.
- **Undo** takes back one change at a time; **Menu** pauses, restarts the board, or goes
  back to the start screen. The clock stops while the menu is open.

## Where the boards come from

Two sources, chosen with a button on the start screen.

**Built-in** deals from a collection generated on a computer and checked twice: 1671 boards
across four sizes. A board is dealt at random and struck off, so none comes round again until
the whole collection has been played; when it runs dry the slate is wiped and the board just
finished is skipped in the fresh round.

**Random** builds a board on the wrist instead. Nobody needs that for quality - the built-in
boards are better - but a board nobody has ever seen is worth something on its own. The
on-watch generator tries for the same guarantees and almost always gets them, but it works to
a time budget: if fourteen attempts all fail to produce a board it can prove, it plays the
last valid one anyway rather than leaving the screen empty. Only the built-in collection is
proved without exception.

Records are kept apart for the two, because a curated board and one the watch happened to
roll are not the same challenge.

Boards are named by **size** - 7x7, 9x9, 11x11, 13x13 - rather than by difficulty. An audit of
an earlier collection found a 13x13 needed exactly the same reasoning as a 7x7, only more of
it, so a label promising harder _thinking_ was promising something the boards did not deliver.
Bigger boards do turn out richer, but that falls out of the space being larger.

## What makes a board worth shipping

Every built-in board has to clear some hard gates and then win a competition.

The gates: exactly one solution; that solution reachable by deduction alone; every island
inside the round playfield; islands reaching most of the way across the board with no empty
quadrant; and no board repeated, by shape more than three times or by layout-and-numbers at
all.

The competition: the generator builds far more boards than it needs - forty to three hundred
candidates per board kept - measures how many of the game's three rules actually do any work
on each, and keeps the best. "Does a rule do work" has an exact meaning: switch the rule off
in the solver and see whether the answer stops being unique. Every shipped board uses at least
two rules, so none of them is arithmetic wearing a puzzle's hat.

The smallest size is the honest casualty: a 7x7 disc holds only 57 island layouts on which the
no-crossing rule does any real work, so it ships 171 boards rather than a padded thousand.

| size  | boards | grid  |
| ----- | ------ | ----- |
| 7x7   | 171    | 7x7   |
| 9x9   | 700    | 9x9   |
| 11x11 | 500    | 11x11 |
| 13x13 | 300    | 13x13 |

## Changing the boards

The grids in `boards/` are the source of truth and are meant to be read in a diff.
`lib/boards.js` is generated from them and committed too, so no build can ever produce a
bundle with no boards in it; a unit test re-packs the grids and compares.

```bash
npm run boards        # rebuild the collection (a few minutes)
npm run pack          # compile boards/*.txt into lib/boards.js
npm run boards:check  # re-prove every shipped board
npm test              # the same proof, plus everything else
```

To make the boards better, change the generator rather than the files: `lib/generator.js`
builds them, `lib/board-quality.js` decides which are worth keeping, `lib/levels.js` holds the
sizes and sample factors. Then regenerate, repack, and commit all three together.

## How it is put together

All the game logic is pure ES modules under `lib/`, free of any Zepp OS import, so it runs
and is tested under Node:

| Module                  | What it owns                                                        |
| ----------------------- | ------------------------------------------------------------------- |
| `lib/puzzle.js`         | The rules: islands, legal pairs, crossings, what a tap may change   |
| `lib/solver.js`         | Solving a board, counting answers, proving no guess is needed       |
| `lib/generator.js`      | Building boards by construction, then grading them                  |
| `lib/rng.js`            | A seeded generator, so any board can be replayed from its seed      |
| `lib/session.js`        | One sitting: selection, undo, "is it finished"                      |
| `lib/board-geometry.js` | Where the board sits in pixels, and what a tap landed on            |
| `lib/camera.js`         | The pannable map and how far it may be dragged                      |
| `lib/gestures.js`       | Telling a tap from a drag                                           |
| `lib/hud.js`            | Where the controls sit on a round screen, and which one was pressed |
| `lib/levels.js`         | The sizes on offer and how hard to search for their boards          |
| `lib/board-quality.js`  | How many of the game's rules a board actually makes you use         |
| `lib/board-format.js`   | A board as a readable grid, and as a packed code                    |
| `lib/boards.js`         | The shipped collection, generated from `boards/`                    |
| `lib/collection.js`     | Dealing built-in boards without repeats                             |
| `lib/sources.js`        | Built-in boards or one rolled on the watch                          |
| `lib/playfield.js`      | Which cells of the grid a round screen can actually show            |
| `lib/progress.js`       | Best times, boards solved, and the pausable clock                   |
| `lib/i18n/`             | The on-watch strings, in eleven languages                           |

`page/index.js` is the only file that talks to Zepp OS. It draws widgets, and routes every
touch through a single transparent layer stacked above them - which is the only way to be
sure that dragging the map is not swallowed by whichever widget happened to be under the
finger. Which control a touch landed on is then worked out by `lib/hud.js`, where it can
be tested.

The app builds for **round** screens only (466 px and 480 px targets).

## Setup

```bash
git clone https://github.com/dchernykh1984/AmazfitBridges.git
cd AmazfitBridges
npm install
```

## Develop

```bash
npm test          # run the unit tests (Vitest)
npm run lint      # ESLint
npm run format    # rewrite files with Prettier
npm run dev       # the Zepp OS simulator
npm run preview   # QR-preview on a device via the Zepp app in Developer Mode
npm run build     # produce the .zab store bundle
```

`dev`, `preview` and `build` fetch the [Zeus CLI](https://docs.zepp.com/docs/guides/quick-start/)
on demand (`npx`), so it is not tracked as a dependency; the first run downloads it.

### App identity

The app is registered in the [Zepp developer console](https://console.zepp.com/) as
**Island Bridges**, appId **`1122446`** - both live in `app.json`. Keep them as they
are: the dev preview and `zeus dev` are cloud-mediated, and an appId that is not
registered to the signed-in account makes the watch install the app but silently
refuse to launch its screen, with no error to go on.

The name on the start screen is deliberately **not** the store name: `title` in
`lib/i18n/labels.js` is the short form ("Bridges", and a translation of it in each of
the other ten languages), because the title row allows twelve characters and the store
name is fourteen. `test/app-config.test.mjs` pins all of this.

## Pre-commit hooks (contributors)

```bash
uv tool install pre-commit   # or: pipx install pre-commit
pre-commit install
```

After that the hooks run automatically: Prettier and ESLint and a non-ASCII guard on
commit, Conventional Commits validation on the commit message, and the unit tests on
push.

## Continuous integration and releases

Every pull request must pass the required checks: Prettier, ESLint, the unit tests,
the app-version check described below, `actionlint`, commitizen (Conventional
Commits), and an OSV dependency scan.

Releases are automated with `release-please`: it maintains a version-bump PR from the
Conventional Commits and, when merged, tags a GitHub Release. The release build
workflow then produces the `.zab` store bundle and attaches it. Uploading the `.zab`
to the Zepp App Store stays manual, because Zepp has no public publish API.

### Two version numbers

A Zepp app carries its version in `app.json`, not in `package.json`: `version.name` is
what a person sees in the store and on the watch, and `version.code` is an integer the
store insists must grow with every upload or it refuses the build. Neither is what
`release-please` bumps.

They are kept in step from `package.json`, which is the one `release-please` does own:

- `release-please` writes `version.name` into `app.json` in the release PR itself
  (`extra-files` in `release-please-config.json`), so the repository never claims a
  version it did not release.
- `npm run version:sync` (`scripts/sync-app-version.mjs`, the version script in `scripts/`)
  writes both numbers, deriving the code as `major * 10000 + minor * 100 + patch`. The
  release build runs it before `zeus build`, and so does `npm run build`, so a bundle
  built in CI and one built on a laptop carry the same numbers. It refuses a version it
  cannot pack - a minor or patch of 100 or more would produce a code that sorts below
  one already in the store.
- `npm run version:check` fails if `app.json` and `package.json` disagree on the name,
  and runs on every pull request. The code is not checked there: `release-please`
  cannot compute it, so between the release PR and the build it is legitimately one
  release behind.

`app.json` is in `.prettierignore` for the same reason - `release-please` rewrites it
with its own JSON formatter, which spreads arrays over lines Prettier would keep
together, and the two would fight on every release PR.

## License

Released under the [MIT License](LICENSE).
