// Re-proves every board the app ships with.
//
//   npm run boards:check
//
// The generator already proved each board before writing it, and the unit tests
// re-prove a sample on every run. This walks the whole collection, which is what
// you want after editing a grid by hand, after changing the rules, or before a
// release. It takes a few seconds.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeCollection, packBoard } from "../lib/board-format.js";
import { BOARD_COUNTS, LEVELS } from "../lib/levels.js";
import { buildPuzzle } from "../lib/puzzle.js";
import { isPlayable } from "../lib/playfield.js";
import { hasUniqueSolution, isForcedSolvable, solvePuzzle } from "../lib/solver.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

let failures = 0;

function complain(level, index, message) {
  failures += 1;
  console.error(`${level.id} board ${index}: ${message}`);
}

for (const level of LEVELS) {
  const started = Date.now();
  const text = readFileSync(join(ROOT, "boards", `${level.id}.txt`), "utf8");
  const collection = decodeCollection(text);

  if (collection === null) {
    console.error(`${level.id}: boards/${level.id}.txt is malformed`);
    failures += 1;
    continue;
  }
  if (collection.boards.length === 0 || collection.boards.length > BOARD_COUNTS[level.id]) {
    console.error(
      `${level.id}: ${collection.boards.length} boards, expected between 1 and ${BOARD_COUNTS[level.id]}`
    );
    failures += 1;
  }

  const seen = new Set();
  for (let i = 0; i < collection.boards.length; i++) {
    const islands = collection.boards[i];

    const code = packBoard(islands);
    if (seen.has(code)) {
      complain(level, i, "is a duplicate of an earlier board");
      continue;
    }
    seen.add(code);

    if (islands.length < level.minIslands) {
      complain(level, i, `has only ${islands.length} islands`);
      continue;
    }
    const stray = islands.find(
      (island) => !isPlayable(level.cols, level.rows, island.col, island.row)
    );
    if (stray !== undefined) {
      complain(level, i, `puts an island outside the round playfield at ${stray.col},${stray.row}`);
      continue;
    }

    const puzzle = buildPuzzle(islands, collection.cols, collection.rows);
    const solved = solvePuzzle(puzzle, { limit: 2, maxNodes: level.maxNodes });
    if (solved.exhausted) {
      complain(level, i, "could not be proved either way inside the node budget");
      continue;
    }
    if (solved.count !== 1) {
      complain(level, i, `has ${solved.count} solutions`);
      continue;
    }
    if (!hasUniqueSolution(puzzle, level.maxNodes) || !isForcedSolvable(puzzle)) {
      complain(level, i, "cannot be solved by deduction alone");
    }
  }

  console.log(
    `${level.id.padEnd(7)} ${String(collection.boards.length).padStart(5)} boards checked  ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`
  );
}

if (failures > 0) {
  console.error(`\n${failures} problem(s) found`);
  process.exit(1);
}
console.log("\nevery shipped board has exactly one solution, reachable without guessing");
