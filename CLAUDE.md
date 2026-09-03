# Working on this repository

`README.md` describes what the app is, where the boards come from and how the code
is arranged; read it first and do not repeat it here. This file is the part that is
not visible from the code: how work is expected to be done.

Longer procedures live in `.claude/skills/`: shipping a change, running a review
cycle, cutting a release, regenerating the board collection, driving the simulator,
preparing a store submission.

## Ground rules

- **Read a file before you change it.** The working tree may carry edits that are
  not yours and are not in the history yet.
- **`lib/` stays pure.** No `@zos/*` imports there. The rules, the solver, the
  generator, the geometry, the text and the records are plain ES modules a test can
  reach under Node; `page/index.js` is the only file that talks to Zepp OS, and it
  turns those modules into widgets and routes touches.
- **Geometry belongs in a module, not in the page.** Where the board sits and what
  a tap hit is `lib/board-geometry.js`; how far the map may be dragged is
  `lib/camera.js`; where the controls sit on a round face is `lib/hud.js`; whether
  a line fits inside the circle at its height is `lib/round-geometry.js`. The app
  ships for two round sizes, 466 and 480, so a number that only works at 466 is a
  bug waiting for the other watch.
- **Source is ASCII**, except `lib/i18n/`, which is legitimately not. A pre-commit
  hook and the same check in CI cover `.js`, `.mjs`, `.json`, `.md` and `.yml`.
  Write files as UTF-8: a PowerShell redirect or `Set-Content` without `-Encoding
utf8` produces UTF-16 and fails the guard for reasons the diff does not show.
- **Comments say why, not what.** Match the density and the voice of the file you
  are editing; the existing comments explain decisions, not syntax.

## What "done" means for a change

A change is finished when all of these are true, and each commit is expected to
stand on its own:

1. The behaviour is covered by tests. There are 21 test files and about 510 cases
   under `test/`, one per `lib/` module; a change to a module belongs in that
   module's test file. `page/index.js` has no test harness - logic that needs one
   belongs in `lib/`, which is the reason the page is as thin as it is.
2. Any new on-watch text exists in all 11 tables in `lib/i18n/labels.js` with the
   key declared in `lib/i18n/keys.js`, and fits the budget `budgetFor` gives it -
   the watch clips, it does not shrink. Reusing an existing key needs no new text;
   say so rather than leaving it unsaid.
3. A change to the board rules, the solver or the generator is re-proved against
   the shipped collection: `npm run boards:check`. `npm test` proves a sample of
   it; `boards:check` proves all of it.
4. `npm test`, `npm run lint` and `npm run format:check` all pass. If `app.json`
   or the version was touched, `npm run version:check` too.
5. The commit message is a single-line Conventional Commit, imperative and specific
   about the change rather than the file: `fix: keep every island inside the round
screen`, not `fix: update playfield.js`. Commitizen validates it locally and in CI.

## Branches and pull requests

- Branch off `main`, named for the change: `fix/records-per-source`,
  `feat/built-in-boards`, `chore/commit-agent-context`. Never commit on `main`.
- `main` is protected by a ruleset: linear history, **rebase merges only**, and one
  approving review - which an account cannot give its own pull request. When the
  person asking has actually asked for the merge,
  `gh pr merge <n> --rebase --delete-branch --admin` is the route that works; it is
  a deliberate bypass of the approval, so never run it unprompted.
- The pull request checks are `pre-commit`, `test`, `actionlint`, `commitizen` and
  the OSV dependency scan. The pull request body is prose - what was wrong, what
  changed, how it is held in place by tests - and the repository's template lists
  what it should answer.
- Pushing, merging, tagging and releasing are the user's call every time. Reading
  (`git status`, `git log`, `git diff`, `gh ... view`) needs no permission.

## Things that will bite you

- **`npx zeus dev` and `zeus build` rewrite `.gitignore`** with their own template,
  which ignores `package-lock.json` (breaking `npm ci` in CI) and no longer keeps
  `.claude/settings.local.json` out. Run `git checkout -- .gitignore` after any
  Zeus command and read `git status` before committing. A hook says so when it
  happens.
- **The Zeus CLI needs Node 18 or 20.** On a newer Node it fails to resolve its own
  modules. CI builds the bundle on Node 20; the tests run on 22.
- **`lib/boards.js` is generated and committed.** Never hand-edit it: change
  `boards/*.txt` and run `npm run pack`, or regenerate both. `test/boards.test.mjs`
  re-packs the grids and compares, so a hand edit fails the tests.
- **`app.json` is Prettier-ignored** and its `version.name` is written by
  release-please. Two version numbers, and why, are explained in `README.md`; do not
  bump either by hand.
- **`tmp/` and `dist/` are ignored** and are the right place for anything a person
  needs to look at but the repository should not carry: store assets, captures,
  scratch notes.
