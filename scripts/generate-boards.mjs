// Builds the collection of boards the app ships with.
//
//   npm run boards            regenerate every difficulty
//   npm run boards -- --level 9x9 --count 50
//
// Run by hand, not by CI. Building and proving one board takes about a
// millisecond, but far more are built than are kept - see the oversample factor
// in lib/levels.js - so the whole collection is a few minutes of work. It is
// also the kind of work whose output is reviewed rather than trusted, and a CI
// job that silently rewrote the boards on every push would defeat that.
//
// Every board written here has already been proved to have exactly one solution
// reachable without guessing (lib/generator.js does that), and is checked once
// more on the way out. Duplicates are dropped by their packed code, so the same
// layout never appears twice in a file.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { encodeCollection, packBoard } from "../lib/board-format.js";
import { generatePuzzle } from "../lib/generator.js";
import { BOARD_COUNTS, LEVELS, MIN_RULES_USED } from "../lib/levels.js";
import { compareBoards, measureBoard } from "../lib/board-quality.js";
import { isValidSolution } from "../lib/puzzle.js";
import { isForcedSolvable, hasUniqueSolution } from "../lib/solver.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BOARDS_DIR = join(HERE, "..", "boards");

// The seed each difficulty starts from. Fixed, so re-running the script with the
// same counts reproduces the same collection exactly.
const BASE_SEED = 20260808;

function parseArgs(argv) {
  const args = { level: null, count: null, oversample: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--level") {
      args.level = argv[i + 1];
    } else if (argv[i] === "--count") {
      args.count = Number(argv[i + 1]);
    } else if (argv[i] === "--oversample") {
      args.oversample = Number(argv[i + 1]);
    }
  }
  return args;
}

// A board is only written if it passes the same gates a second time. The
// generator already checked them; this is the belt to its braces, because these
// boards are shipped and never checked again on the watch.
function accept(level, generated) {
  if (generated === null || !generated.fair || !generated.unique) {
    return false;
  }
  if (!isValidSolution(generated.puzzle, generated.solution)) {
    return false;
  }
  if (!isWellSpread(level, generated.puzzle.islands)) {
    return false;
  }
  if (!hasUniqueSolution(generated.puzzle, level.maxNodes)) {
    return false;
  }
  return isForcedSolvable(generated.puzzle);
}

// A board that is correct can still be a poor thing to look at: the growth
// algorithm can wander off in one direction and leave half the playfield empty,
// which reads as a bug even though every rule holds. Two cheap shape checks
// throw those away - the islands have to reach most of the way across the board
// in both directions, and each quarter of it has to hold at least one.
function isWellSpread(level, islands) {
  const cols = islands.map((island) => island.col);
  const rows = islands.map((island) => island.row);
  const spanCols = Math.max(...cols) - Math.min(...cols);
  const spanRows = Math.max(...rows) - Math.min(...rows);

  // The round playfield already costs a cell at each edge, so the reachable
  // span is two less than the grid; ask for all but one of what is left.
  if (spanCols < level.cols - 3 || spanRows < level.rows - 3) {
    return false;
  }

  const midCol = (level.cols - 1) / 2;
  const midRow = (level.rows - 1) / 2;
  const quadrants = [0, 0, 0, 0];
  for (const island of islands) {
    if (island.col === midCol || island.row === midRow) {
      continue;
    }
    quadrants[(island.col < midCol ? 0 : 1) + (island.row < midRow ? 0 : 2)] += 1;
  }
  return quadrants.every((count) => count > 0);
}

// Islands by position alone, ignoring the numbers on them: two boards with the
// same shape look the same at a glance even when they solve differently.
function layoutOf(islands) {
  return islands.map((island) => island.col + ":" + island.row).join(",");
}

// How many boards may share one shape. The smallest board runs out of shapes
// long before it runs out of quota, so some reuse is unavoidable - but a shape
// that comes round a dozen times reads as a repetitive collection whatever the
// numbers on it say.
const MAX_SHAPE_USES = 3;

// Build far more boards than are wanted, then keep the best of them.
//
// This is what turns "interesting" from a threshold into a competition. A
// threshold has to be set per size by hand and is either unreachable on the small
// boards or toothless on the large ones; a competition adapts on its own, because
// the 13x13 candidate pool is simply richer than the 7x7 one. The gradient the
// player feels between sizes is a consequence of that, not of any number here.
function buildLevel(level, want, oversample) {
  const seenBoards = new Set();
  const candidates = [];
  const budget = want * oversample;
  let seed = BASE_SEED;

  for (let tried = 0; tried < budget; tried++) {
    const generated = generatePuzzle(level, seed);
    seed += 1;
    if (!accept(level, generated)) {
      continue;
    }

    const islands = generated.puzzle.islands.map((island) => ({
      col: island.col,
      row: island.row,
      required: island.required,
    }));
    const code = packBoard(islands);
    if (seenBoards.has(code)) {
      continue;
    }
    seenBoards.add(code);

    const quality = measureBoard(generated.puzzle, generated.solution, level.maxNodes);
    if (quality.rulesUsed < MIN_RULES_USED) {
      // Correct, but the player would never have to use more than one of the
      // game's rules on it. Quantity is not the goal - a smaller collection of
      // boards worth playing beats a full one padded with arithmetic.
      continue;
    }

    candidates.push({ islands, code, layout: layoutOf(islands), quality });
  }

  // Best first, with the packed code breaking any remaining tie so that the same
  // seed always produces byte-identical files.
  candidates.sort((a, b) => compareBoards(a.quality, b.quality) || (a.code < b.code ? -1 : 1));

  // Take the best, but never let one shape crowd the collection: without this the
  // top of the ranking clusters on the handful of layouts that happen to admit a
  // crossing, and a technically excellent collection looks repetitive.
  const uses = new Map();
  const boards = [];
  for (let i = 0; i < candidates.length && boards.length < want; i++) {
    const used = uses.get(candidates[i].layout) || 0;
    if (used >= MAX_SHAPE_USES) {
      continue;
    }
    uses.set(candidates[i].layout, used + 1);
    boards.push(candidates[i]);
  }

  const rules = [0, 0, 0, 0];
  for (const board of boards) {
    rules[board.quality.rulesUsed] += 1;
  }

  return {
    boards: boards.map((board) => board.islands),
    layouts: uses.size,
    considered: candidates.length,
    rules,
  };
}

const args = parseArgs(process.argv.slice(2));
const chosen = args.level ? LEVELS.filter((level) => level.id === args.level) : LEVELS;
if (chosen.length === 0) {
  console.error(`unknown level "${args.level}"`);
  process.exit(1);
}

mkdirSync(BOARDS_DIR, { recursive: true });

for (const level of chosen) {
  const want = args.count || BOARD_COUNTS[level.id];
  const started = Date.now();
  const { boards, layouts, considered, rules } = buildLevel(
    level,
    want,
    args.oversample || level.oversample
  );

  if (boards.length === 0) {
    console.error(`${level.id}: produced no boards at all`);
    process.exit(1);
  }

  const text = encodeCollection(boards, level.cols, level.rows, [
    `Island Bridges boards - ${level.id}`,
    "GENERATED by scripts/generate-boards.mjs - do not edit by hand",
    `seed ${BASE_SEED}, ${boards.length} boards, every one with a single solution`,
    "reachable by deduction alone, picked as the best of many candidates",
  ]);

  const file = join(BOARDS_DIR, `${level.id}.txt`);
  writeFileSync(file, text, "utf8");
  console.log(
    `${level.id.padEnd(6)} kept ${String(boards.length).padStart(5)} of ${String(considered).padStart(6)} candidates  ` +
      `${String(layouts).padStart(5)} shapes  rules used 3/2/1/0: ` +
      `${rules[3]}/${rules[2]}/${rules[1]}/${rules[0]}  ` +
      `${((Date.now() - started) / 1000).toFixed(0)}s  ${(text.length / 1024).toFixed(0)} KB`
  );
}
