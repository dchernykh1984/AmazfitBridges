---
name: shipping-a-change
description: Branch, commit, open a pull request and drive CI to green in this repository. Use whenever you are about to commit, push, open a pull request, or check the status of one.
---

# Shipping a change

## Ask before anything outward-facing

Pushing, merging, tagging, deleting a branch and creating a release are the user's
call, every time. Show the exact command and wait for a plain yes; narrating what
you are about to do is not consent. Reading needs no permission: `git status`,
`git log`, `git diff`, `git fetch`, `gh pr view`, `gh run view`.

## Branch

```bash
git fetch origin && git switch -c <type>/<slug> origin/main
```

Never commit on `main`. Name the branch for the change, not for the tool:
`fix/records-per-source`, `feat/built-in-boards`, `chore/commit-agent-context`.
Stage the files you changed (`git add <path>`), not `git add -A` - `dist/` and
`tmp/` are ignored, but a stray note or a half-finished script is not.

## Commit

- One line, Conventional Commits, imperative, specific about the change rather
  than the file. The history is the model: `fix: keep every island inside the
round screen`, `feat: measure how many of the game's rules a board actually
uses`, `test: cover the solver's rule switches and the connectivity deduction`.
- **The subject line is the whole message.** No body, no trailers, and no
  `Co-Authored-By` - every commit in this repository is a single line and it stays
  that way. Whatever an agent's own configuration says about attribution, it does
  not apply here. The same goes for the pull request body: prose about the change,
  with no "Generated with" footer.
- The type decides the changelog: `feat` and `fix` produce a release entry,
  `chore`, `docs`, `test`, `refactor`, `build` and `style` do not. `cz check
--rev-range origin/main..HEAD` runs in CI and rejects anything else.
- One logical change per commit, each one green on its own. A review cycle's
  findings are their own commit, not a fold-in.

## Before pushing

```bash
npm test              # 21 files, about 510 cases; a few seconds
npm run lint
npm run format:check
npm run version:check # only meaningful if app.json or the version moved
npm run boards:check  # only if the rules, the solver or boards/ changed
```

pre-commit runs Prettier, ESLint and the ASCII guard again on commit and the tests
on push, so a clean run here means the hooks have nothing to say. Never reach for
`--no-verify`; if one hook cannot run on this machine, skip that one by name with
`SKIP=<hook-id>`.

If any Zeus command ran (`npm run dev`, `npm run build`, `npm run preview`), check
`.gitignore` before committing: Zeus overwrites it with its own template.

## Pull request

```bash
git push -u origin <branch>
gh pr create --base main --title "<the same conventional-commit line>" --body "..."
```

The body is prose: what was wrong, what changed, and how it is held in place by
tests. The repository's template lists what it should answer - answering it in
sentences is better than pasting the checklist back. Say plainly when there are no
new strings to translate, and when a change is documentation only.

## Watch CI to green

Poll the rollup rather than `gh pr checks`, whose per-check status lags:

```bash
gh pr view <n> --json statusCheckRollup \
  --jq '[.statusCheckRollup[] | {name:(.name//.context), s:(.conclusion//.state)}]'
```

or, to sit and wait, `gh pr checks <n> --watch --interval 20`.

The checks are `pre-commit` (Prettier, ESLint, the file-hygiene hooks), `test`
(Vitest plus `version:check`), `commitizen`, `actionlint`, and the OSV dependency
scan. Every one must be green before asking for review. `commitizen` does not run
on `main` - it needs a range against `origin/main`.

The OSV scan uploads SARIF to GitHub code scanning, which needs the repository to
be public; on a private fork that job fails with zero vulnerabilities, which is the
visibility rather than the dependencies.

## Merging

The ruleset on `main` allows **rebase merges only**, requires linear history and
one approving review - which GitHub will not accept from the account that opened
the pull request, so `gh pr review --approve` on your own fails with `Can not
approve your own pull request`. Do not retry it. When the person asking has asked
for the merge:

```bash
gh pr merge <n> --rebase --delete-branch --admin
```

`--admin` is a deliberate bypass of that approval. Never run it unprompted.

Dependabot keeps npm and Actions current; its pull requests go through the same
gates. A lockfile bump that turns CI red is worth reading before re-running it.
