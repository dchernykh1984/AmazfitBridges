// The Zeus CLI rewrites .gitignore when it builds or runs the simulator, quietly
// dropping most of the file - including the line that keeps package-lock.json in
// the repository, without which `npm ci` fails in CI, and the one that keeps
// .claude/settings.local.json out of it.
//
// This says so the moment it happens, and says nothing otherwise. It never edits
// anything: a deliberate change to .gitignore is a normal thing to make, and a
// hook that reverted it would be worse than the problem.
import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

try {
  const dirty = git(["status", "--porcelain", "--", ".gitignore"]).trim();
  if (dirty !== "") {
    const diff = git(["diff", "--numstat", "--", ".gitignore"]).trim().split(/\s+/);
    const removed = Number(diff[1]);
    // A hand edit adds or removes a line or two; Zeus takes most of the file.
    const wholesale = Number.isFinite(removed) && removed > 10;
    console.log(
      wholesale
        ? ".gitignore has been rewritten (" +
            removed +
            " lines removed) - this is what the Zeus CLI does. Restore it with " +
            "`git checkout -- .gitignore` before committing anything."
        : ".gitignore is modified. If you did not edit it deliberately, the Zeus " +
            "CLI did: restore it with `git checkout -- .gitignore`."
    );
  }
} catch {
  // Not a git checkout, or git is unavailable. Nothing to say.
}
