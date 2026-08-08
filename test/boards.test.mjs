import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodeCollection, packBoard, unpackBoard } from "../lib/board-format.js";
import { BUILT_IN_BOARDS } from "../lib/boards.js";
import { BOARD_COUNTS, LEVELS, MIN_RULES_USED } from "../lib/levels.js";
import { measureBoard } from "../lib/board-quality.js";
import { isPlayable } from "../lib/playfield.js";
import { buildPuzzle } from "../lib/puzzle.js";
import { hasUniqueSolution, isForcedSolvable, solvePuzzle } from "../lib/solver.js";

const grids = (name) =>
  decodeCollection(
    readFileSync(fileURLToPath(new URL(`../boards/${name}.txt`, import.meta.url)), "utf8")
  );

describe.each(LEVELS)("the boards shipped for $id", (level) => {
  const collection = grids(level.id);
  const packed = BUILT_IN_BOARDS[level.id];

  it("is a readable file of grids", () => {
    expect(collection, `boards/${level.id}.txt did not parse`).not.toBe(null);
  });

  it("ships as many boards as the quality bar allowed, and no more than asked", () => {
    // The count is whatever survived the quality bar, not a fixed quota: the
    // smallest board runs out of layouts that use the rules long before it runs
    // out of quota. What must hold is that the file and the packed module agree.
    expect(collection.boards.length).toBeGreaterThan(0);
    expect(collection.boards.length).toBeLessThanOrEqual(BOARD_COUNTS[level.id]);
    expect(packed.length).toBe(collection.boards.length);
  });

  it("is written on a grid of the difficulty's own size", () => {
    expect(collection.cols).toBe(level.cols);
    expect(collection.rows).toBe(level.rows);
  });

  it("matches the packed module exactly", () => {
    // The whole point of committing the generated module: if someone edits a
    // grid and forgets to run `npm run pack`, this fails rather than shipping a
    // bundle that disagrees with its own source of truth.
    const repacked = collection.boards.map((islands) => packBoard(islands));
    expect(repacked).toEqual(packed);
  });

  it("unpacks back into the very same islands", () => {
    for (let i = 0; i < packed.length; i++) {
      expect(unpackBoard(packed[i]), `${level.id} board ${i}`).toEqual(collection.boards[i]);
    }
  });

  it("never repeats a board", () => {
    expect(new Set(packed).size).toBe(packed.length);
  });

  it("keeps every island inside the round playfield", () => {
    for (let i = 0; i < collection.boards.length; i++) {
      for (const island of collection.boards[i]) {
        expect(
          isPlayable(level.cols, level.rows, island.col, island.row),
          `${level.id} board ${i} at ${island.col},${island.row}`
        ).toBe(true);
      }
    }
  });

  it("gives every board enough islands to be worth playing", () => {
    for (let i = 0; i < collection.boards.length; i++) {
      expect(collection.boards[i].length, `${level.id} board ${i}`).toBeGreaterThanOrEqual(
        level.minIslands
      );
      expect(collection.boards[i].length, `${level.id} board ${i}`).toBeLessThanOrEqual(
        level.islands
      );
    }
  });

  it("gives every island a number between one and eight", () => {
    for (let i = 0; i < collection.boards.length; i++) {
      for (const island of collection.boards[i]) {
        expect(island.required, `${level.id} board ${i}`).toBeGreaterThanOrEqual(1);
        expect(island.required, `${level.id} board ${i}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("has exactly one solution for every board, reachable without guessing", () => {
    // The full sweep, not a sample: proving all 2500 shipped boards takes well
    // under a second, so there is no reason to trust the generator instead.
    for (let i = 0; i < collection.boards.length; i++) {
      const puzzle = buildPuzzle(collection.boards[i], level.cols, level.rows);
      expect(hasUniqueSolution(puzzle, level.maxNodes), `${level.id} board ${i}`).toBe(true);
      expect(isForcedSolvable(puzzle), `${level.id} board ${i}`).toBe(true);
    }
  });

  it("makes the player use more than one of the game's rules on every board", () => {
    // The whole reason the collection is picked rather than merely generated.
    for (let i = 0; i < collection.boards.length; i++) {
      const puzzle = buildPuzzle(collection.boards[i], level.cols, level.rows);
      const solution = solvePuzzle(puzzle, { limit: 1, maxNodes: level.maxNodes }).solution;
      const quality = measureBoard(puzzle, solution, level.maxNodes);
      expect(quality.rulesUsed, `${level.id} board ${i}`).toBeGreaterThanOrEqual(MIN_RULES_USED);
      expect(quality.bothKinds, `${level.id} board ${i} has only one kind of bridge`).toBe(true);
      expect(quality.crossings, `${level.id} board ${i} never needs the crossing rule`).toBe(true);
    }
  });

  it("offers a spread of layouts rather than one shape over and over", () => {
    // The generator takes a board with an unseen shape whenever it can and only
    // then falls back to reusing a shape with different numbers on it. The
    // smallest board is the one that runs out: a 7x7 disc holds so few legal
    // arrangements that a thousand boards cannot all look different.
    const uses = new Map();
    for (const islands of collection.boards) {
      const shape = islands.map((island) => island.col + ":" + island.row).join(",");
      uses.set(shape, (uses.get(shape) || 0) + 1);
    }
    expect(uses.size, level.id).toBeGreaterThan(1);
    expect(
      Math.max(...uses.values()),
      `${level.id} reuses one shape too often`
    ).toBeLessThanOrEqual(3);
  });

  it("spreads the islands over the whole board rather than one corner of it", () => {
    // A board can obey every rule and still look broken because the layout
    // wandered off in one direction and left half the playfield empty.
    for (let i = 0; i < collection.boards.length; i++) {
      const islands = collection.boards[i];
      const cols = islands.map((island) => island.col);
      const rows = islands.map((island) => island.row);
      expect(
        Math.max(...cols) - Math.min(...cols),
        `${level.id} board ${i}`
      ).toBeGreaterThanOrEqual(level.cols - 3);
      expect(
        Math.max(...rows) - Math.min(...rows),
        `${level.id} board ${i}`
      ).toBeGreaterThanOrEqual(level.rows - 3);

      const midCol = (level.cols - 1) / 2;
      const midRow = (level.rows - 1) / 2;
      const quadrants = [0, 0, 0, 0];
      for (const island of islands) {
        if (island.col === midCol || island.row === midRow) {
          continue;
        }
        quadrants[(island.col < midCol ? 0 : 1) + (island.row < midRow ? 0 : 2)] += 1;
      }
      for (let q = 0; q < 4; q++) {
        expect(quadrants[q], `${level.id} board ${i} has an empty quadrant ${q}`).toBeGreaterThan(
          0
        );
      }
    }
  });
});

describe("the built-in collection as a whole", () => {
  it("covers every difficulty and nothing else", () => {
    expect(Object.keys(BUILT_IN_BOARDS).sort()).toEqual(LEVELS.map((level) => level.id).sort());
  });

  it("declares a count for every difficulty", () => {
    expect(Object.keys(BOARD_COUNTS).sort()).toEqual(LEVELS.map((level) => level.id).sort());
    for (const level of LEVELS) {
      expect(BOARD_COUNTS[level.id], level.id).toBeGreaterThan(0);
    }
  });

  it("ships fewer of the big boards than the small ones", () => {
    // They take longer to play and more room to store.
    for (let i = 1; i < LEVELS.length; i++) {
      expect(BOARD_COUNTS[LEVELS[i].id]).toBeLessThanOrEqual(BOARD_COUNTS[LEVELS[i - 1].id]);
    }
  });
});
