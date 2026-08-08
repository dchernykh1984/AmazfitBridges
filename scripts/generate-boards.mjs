// Builds the collection of boards the app ships with.
//
//   npm run boards            regenerate every difficulty
//   npm run boards -- --level easy --count 50
//
// Run by hand, not by CI. Generating and proving a board takes about a
// millisecond, so the whole collection is a few seconds of work - but it is the
// kind of work whose output is reviewed rather than trusted, and a CI job that
// silently rewrote the boards on every push would defeat that.
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
import { BOARD_COUNTS, LEVELS } from "../lib/levels.js";
import { isValidSolution } from "../lib/puzzle.js";
import { isForcedSolvable, hasUniqueSolution } from "../lib/solver.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BOARDS_DIR = join(HERE, "..", "boards");

// The seed each difficulty starts from. Fixed, so re-running the script with the
// same counts reproduces the same collection exactly.
const BASE_SEED = 20260808;

function parseArgs(argv) {
  const args = { level: null, count: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--level") {
      args.level = argv[i + 1];
    } else if (argv[i] === "--count") {
      args.count = Number(argv[i + 1]);
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

// How many boards may share one shape. The smallest difficulty runs out of
// shapes long before it runs out of quota, so some reuse is unavoidable - but a
// shape that came round eleven times in a thousand boards is a collection that
// feels repetitive, whatever the numbers on it say.
const MAX_SHAPE_USES = 3;

// Fill the quota in two passes. The first takes only boards whose shape has not
// been seen before, so the collection is as varied as the board size allows; the
// second tops it up with boards that reuse a shape but carry different numbers -
// still a different puzzle to solve, just a familiar picture - and never lets one
// shape appear more than MAX_SHAPE_USES times.
function buildLevel(level, count) {
  const seenBoards = new Set();
  const layoutUses = new Map();
  const boards = [];
  let rejected = 0;
  let seed = BASE_SEED;
  let tried = 0;

  const take = (requireNewLayout, budget) => {
    const until = tried + budget;
    while (boards.length < count && tried < until) {
      const generated = generatePuzzle(level, seed);
      seed += 1;
      tried += 1;
      if (!accept(level, generated)) {
        rejected += 1;
        continue;
      }

      const islands = generated.puzzle.islands.map((island) => ({
        col: island.col,
        row: island.row,
        required: island.required,
      }));
      const code = packBoard(islands);
      const layout = layoutOf(islands);
      const used = layoutUses.get(layout) || 0;
      if (seenBoards.has(code) || used >= (requireNewLayout ? 1 : MAX_SHAPE_USES)) {
        rejected += 1;
        continue;
      }

      seenBoards.add(code);
      layoutUses.set(layout, used + 1);
      boards.push(islands);
    }
  };

  take(true, count * 30);
  take(false, count * 30);

  return { boards, rejected, tried, layouts: layoutUses.size };
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
  const { boards, rejected, tried, layouts } = buildLevel(level, want);

  if (boards.length < want) {
    console.error(
      `${level.id}: only produced ${boards.length} of ${want} boards after ${tried} seeds`
    );
    process.exit(1);
  }

  const text = encodeCollection(boards, level.cols, level.rows, [
    `Island Bridges boards - ${level.id} (${level.cols}x${level.rows})`,
    "GENERATED by scripts/generate-boards.mjs - do not edit by hand",
    `seed ${BASE_SEED}, ${boards.length} boards, every one with a single solution`,
    "reachable by deduction alone",
  ]);

  const file = join(BOARDS_DIR, `${level.id}.txt`);
  writeFileSync(file, text, "utf8");
  console.log(
    `${level.id.padEnd(7)} ${String(boards.length).padStart(5)} boards  ${String(layouts).padStart(5)} shapes  ` +
      `${String(rejected).padStart(4)} rejected  ${((Date.now() - started) / 1000).toFixed(1)}s  ` +
      `${(text.length / 1024).toFixed(0)} KB`
  );
}
