import { describe, it, expect } from "vitest";
import { generateCandidate, generatePuzzle } from "../lib/generator.js";
import { LEVELS } from "../lib/levels.js";
import { isValidSolution, MAX_BRIDGES, MAX_REQUIRED } from "../lib/puzzle.js";
import { hasUniqueSolution, isForcedSolvable } from "../lib/solver.js";
import { isPlayable } from "../lib/playfield.js";
import { applyEdge, createSession } from "../lib/session.js";

// Enough seeds to catch a layout rule that only breaks now and then, without
// making the suite something people skip.
const SEEDS = [1, 2, 3, 7, 11, 64, 512, 4242, 99991, 2147483647];

function boardsFor(level) {
  return SEEDS.map((seed) => generatePuzzle(level, seed));
}

describe.each(LEVELS)("generatePuzzle for $id", (level) => {
  const boards = boardsFor(level);

  it("always produces a board", () => {
    for (const board of boards) {
      expect(board).not.toBe(null);
    }
  });

  it("reaches the island count the difficulty asks for", () => {
    for (const board of boards) {
      expect(board.puzzle.islands.length).toBeGreaterThanOrEqual(level.minIslands);
      expect(board.puzzle.islands.length).toBeLessThanOrEqual(level.islands);
    }
  });

  it("keeps every island on the board", () => {
    for (const board of boards) {
      for (const island of board.puzzle.islands) {
        expect(island.col).toBeGreaterThanOrEqual(0);
        expect(island.row).toBeGreaterThanOrEqual(0);
        expect(island.col).toBeLessThan(level.cols);
        expect(island.row).toBeLessThan(level.rows);
      }
    }
  });

  it("keeps every island inside the round playfield", () => {
    // Otherwise it is drawn where a round watch has no glass.
    for (const board of boards) {
      for (const island of board.puzzle.islands) {
        expect(
          isPlayable(level.cols, level.rows, island.col, island.row),
          `${level.id} ${island.col},${island.row}`
        ).toBe(true);
      }
    }
  });

  it("gives every island a number between one and eight", () => {
    for (const board of boards) {
      for (const island of board.puzzle.islands) {
        expect(island.required).toBeGreaterThanOrEqual(1);
        expect(island.required).toBeLessThanOrEqual(MAX_REQUIRED);
      }
    }
  });

  it("never puts two islands in touching cells", () => {
    for (const board of boards) {
      const taken = new Set(board.puzzle.islands.map((i) => i.row * level.cols + i.col));
      for (const island of board.puzzle.islands) {
        const neighbours = [
          [island.col + 1, island.row],
          [island.col - 1, island.row],
          [island.col, island.row + 1],
          [island.col, island.row - 1],
        ];
        for (const [col, row] of neighbours) {
          expect(taken.has(row * level.cols + col)).toBe(false);
        }
      }
    }
  });

  it("ships an answer that obeys every rule", () => {
    for (const board of boards) {
      expect(isValidSolution(board.puzzle, board.solution)).toBe(true);
    }
  });

  it("never uses more than two bridges between the same pair", () => {
    for (const board of boards) {
      for (const count of board.solution) {
        expect(count).toBeLessThanOrEqual(MAX_BRIDGES);
      }
    }
  });

  it("leaves room to draw every bridge it uses", () => {
    for (const board of boards) {
      for (const edge of board.puzzle.edges) {
        if (board.solution[edge.id] > 0) {
          expect(Math.abs(edge.to - edge.from)).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("has exactly one answer, reachable without guessing", () => {
    for (const board of boards) {
      expect(board.unique).toBe(true);
      expect(board.fair).toBe(true);
      expect(hasUniqueSolution(board.puzzle, level.maxNodes)).toBe(true);
      expect(isForcedSolvable(board.puzzle)).toBe(true);
    }
  });

  it("can actually be played to a finish through the game's own rules", () => {
    for (const board of boards) {
      const session = createSession(board.puzzle);
      for (const edge of board.puzzle.edges) {
        for (let laid = 0; laid < board.solution[edge.id]; laid++) {
          applyEdge(session, edge.id);
        }
      }
      expect(session.state).toEqual(board.solution);
      expect(session.solved).toBe(true);
    }
  });
});

describe("generatePuzzle", () => {
  it("is reproducible: the same seed gives the same board", () => {
    const first = generatePuzzle(LEVELS[1], 20260803);
    const second = generatePuzzle(LEVELS[1], 20260803);
    expect(first.seed).toBe(second.seed);
    expect(first.puzzle.islands).toEqual(second.puzzle.islands);
    expect(first.solution).toEqual(second.solution);
  });

  it("gives different seeds different boards", () => {
    const boards = SEEDS.map((seed) => generatePuzzle(LEVELS[2], seed));
    const shapes = new Set(boards.map((board) => JSON.stringify(board.puzzle.islands)));
    expect(shapes.size).toBe(SEEDS.length);
  });

  it("copes with a seed that is not a number", () => {
    expect(generatePuzzle(LEVELS[0], undefined)).not.toBe(null);
    expect(generatePuzzle(LEVELS[0], "nonsense")).not.toBe(null);
  });

  it("reports the seed the board it returned actually came from", () => {
    const board = generatePuzzle(LEVELS[0], 5150);
    const rebuilt = generateCandidate(LEVELS[0], board.seed);
    expect(rebuilt.puzzle.islands).toEqual(board.puzzle.islands);
    expect(rebuilt.solution).toEqual(board.solution);
  });

  it("gives up and returns nothing when it is allowed no attempts", () => {
    expect(generatePuzzle({ ...LEVELS[0], attempts: 0 }, 1)).toBe(null);
  });

  it("falls back to a merely-playable board rather than nothing", () => {
    // One attempt and no thinking budget: the quality gate cannot pass, so the
    // candidate is handed over flagged as unproven instead of being thrown away.
    const board = generatePuzzle({ ...LEVELS[0], attempts: 1, maxNodes: 1 }, 31337);
    expect(board).not.toBe(null);
    expect(board.unique).toBe(false);
    expect(board.fair).toBe(false);
    expect(isValidSolution(board.puzzle, board.solution)).toBe(true);
  });
});

describe("generateCandidate", () => {
  it("returns nothing when the layout cannot reach the size asked for", () => {
    // A 3x3 board has room for very few islands once they may not touch.
    expect(generateCandidate({ ...LEVELS[0], cols: 3, rows: 3, minIslands: 20 }, 1)).toBe(null);
  });

  it("builds a connected answer even before the quality gate sees it", () => {
    for (const seed of SEEDS) {
      const candidate = generateCandidate(LEVELS[1], seed);
      if (candidate !== null) {
        expect(isValidSolution(candidate.puzzle, candidate.solution)).toBe(true);
      }
    }
  });
});
