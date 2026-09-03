---
name: release
description: Cut a release of this Zepp OS app end to end - merge the change, approve and watch the release-please pull request, merge it, and verify the .zab bundle the release build attaches. Use when asked to release, ship, publish a version, or check what a release actually built.
---

# Cutting a release

Releases are automated with release-please. Nothing here bumps a version by hand:
`package.json` is the version release-please owns, `app.json` gets its
`version.name` from the release pull request (`extra-files` in
`release-please-config.json`) and its `version.code` from `npm run version:sync` at
build time. `README.md` explains why there are two numbers; do not fight them.

## The flow

1. **Merge the change into `main`** - only when the person asking has asked for
   that merge.

   ```bash
   gh pr merge <n> --rebase --delete-branch --admin
   ```

   `--admin` is needed because the ruleset wants an approval and an account cannot
   approve its own pull request.

2. **Wait for the release pull request.** Release Please runs on the push to `main`
   and opens or updates one titled
   `chore(main): release amazfit-bridges <version>` on the branch
   `release-please--branches--main--components--amazfit-bridges`.

   ```bash
   gh pr list --state open
   ```

3. **Approve its workflow runs if they are waiting.** A pull request from a bot
   branch can leave its runs in `action_required`, where they never start on their
   own:

   ```bash
   gh run list --limit 6
   gh api -X POST repos/dchernykh1984/AmazfitBridges/actions/runs/<id>/approve
   ```

   Do not approve workflows on a release nobody asked for.

4. **Watch the checks.**

   ```bash
   gh pr checks <n> --watch --interval 20
   ```

   If they go red, fix the cause on `main` with a normal pull request; the release
   pull request rebases itself onto the fix. Never merge a red release.

5. **Merge the release pull request.** It tags the release and creates the GitHub
   Release; `build-and-distribute.yml` then builds the `.zab` with the Zeus CLI on
   Node 20 and attaches it.

   ```bash
   gh pr merge <n> --rebase --admin
   gh release list --limit 3
   gh release view <tag> --json assets --jq '.assets[] | "\(.name)  \(.size)"'
   ```

## Verifying what was built

A green pipeline says the build ran, not that it built what you think. Check the
bundle itself:

```bash
gh release download <tag> --pattern "*.zab"
cp *.zab bundle.zip && unzip -q bundle.zip -d out
node -e 'const m=require("./out/manifest.json");
  for (const z of m.zpks) console.log(z.version.name, "code "+z.version.code,
    z.platforms.map(p=>p.screenType+" "+p.screenResolution).join(", "));'
```

Expect one `.zpk` per shipped platform, every one carrying the same version name
and code, and round resolutions only - this app targets 466 and 480 (`targets` in
`app.json`). The code is `major * 10000 + minor * 100 + patch`, so 0.3.0 is 300;
`scripts/sync-app-version.mjs` refuses a minor or patch of 100 or more, which would
produce a code sorting below one already in the store.

To look inside one: a `.zpk` is a zip holding `device.zip`, which holds `app.json`
and `page/index.bin`. **`index.bin` is compiled bytecode, not JavaScript** - a text
search for a string or a number finds nothing. Probe its constant pool instead,
which is how a specific change is proved to be in the build:

```bash
node -e 'const fs=require("fs");const bin=fs.readFileSync("page/index.bin");
  const d=v=>{const b=Buffer.alloc(8);b.writeDoubleLE(v);return bin.indexOf(b)>=0};
  const i=v=>{const b=Buffer.alloc(4);b.writeInt32LE(v);return bin.indexOf(b)>=0};
  console.log("fraction present:", d(0.82), "| colour present:", i(0x5a5148));'
```

Pick constants the change introduced. Strings are worth searching for in the whole
`.zab` rather than in the bytecode, and Zeus stores non-ASCII as UTF-16LE, so
decode both byte alignments before concluding a translation is missing.

Work in `tmp/` (ignored), not in the repository root.

## Uploading to the store

The `.zab` is only the artifact. Putting it in the Zepp App Store is manual - Zepp
has no publish API. See the `store-submission` skill.
