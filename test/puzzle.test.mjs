import { describe, it, expect } from "vitest";
import {
  allIslandsSatisfied,
  buildPuzzle,
  canPlace,
  cloneState,
  degree,
  DONE,
  edgeBetween,
  edgesCross,
  emptyState,
  isBlocked,
  isConnected,
  isSolved,
  islandStatus,
  isValidSolution,
  MAX_BRIDGES,
  movesFrom,
  nextCount,
  remaining,
  satisfiedCount,
  UNDER,
  withBridge,
} from "../lib/puzzle.js";
import {
  blockedRowPuzzle,
  crossingPuzzle,
  edgeAtCells,
  linePuzzle,
  ringPuzzle,
} from "./fixtures.mjs";

describe("buildPuzzle", () => {
  it("numbers islands in reading order whatever order they came in", () => {
    const puzzle = buildPuzzle(
      [
        { col: 4, row: 2, required: 1 },
        { col: 0, row: 0, required: 1 },
        { col: 2, row: 0, required: 2 },
      ],
      5,
      3
    );
    expect(puzzle.islands.map((island) => [island.col, island.row])).toEqual([
      [0, 0],
      [2, 0],
      [4, 2],
    ]);
    expect(puzzle.islands.map((island) => island.id)).toEqual([0, 1, 2]);
  });

  it("joins only islands with nothing between them", () => {
    const puzzle = blockedRowPuzzle();
    expect(edgeAtCells(puzzle, [0, 0], [2, 0])).toBeGreaterThanOrEqual(0);
    expect(edgeAtCells(puzzle, [2, 0], [4, 0])).toBeGreaterThanOrEqual(0);
    // The outer pair has an island in the way.
    expect(edgeAtCells(puzzle, [0, 0], [4, 0])).toBe(-1);
  });

  it("finds each pair exactly once", () => {
    const puzzle = ringPuzzle();
    const seen = new Set();
    for (const edge of puzzle.edges) {
      const key = Math.min(edge.a, edge.b) + ":" + Math.max(edge.a, edge.b);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(puzzle.edges.length).toBe(7);
  });

  it("lists every edge under both of its islands", () => {
    const puzzle = ringPuzzle();
    for (const edge of puzzle.edges) {
      expect(puzzle.edgesByIsland[edge.a]).toContain(edge.id);
      expect(puzzle.edgesByIsland[edge.b]).toContain(edge.id);
    }
  });

  it("records the total number of bridges the answer must have", () => {
    expect(linePuzzle().total).toBe(2);
    expect(ringPuzzle().total).toBe(6);
  });

  it("never joins two islands diagonally", () => {
    const puzzle = ringPuzzle();
    for (const edge of puzzle.edges) {
      const a = puzzle.islands[edge.a];
      const b = puzzle.islands[edge.b];
      expect(a.col === b.col || a.row === b.row).toBe(true);
    }
  });
});

describe("edgesCross", () => {
  const horizontal = { horizontal: true, row: 1, from: 0, to: 4 };

  it("crosses a vertical lane that passes through it", () => {
    expect(edgesCross(horizontal, { horizontal: false, col: 2, from: 0, to: 3 })).toBe(true);
  });

  it("does not cross a lane that stops short", () => {
    expect(edgesCross(horizontal, { horizontal: false, col: 2, from: 2, to: 3 })).toBe(false);
    expect(edgesCross(horizontal, { horizontal: false, col: 6, from: 0, to: 3 })).toBe(false);
  });

  it("does not cross where they only touch at an end", () => {
    // A shared endpoint is an island, and bridges are allowed to meet there.
    expect(edgesCross(horizontal, { horizontal: false, col: 0, from: 0, to: 3 })).toBe(false);
    expect(edgesCross(horizontal, { horizontal: false, col: 2, from: 1, to: 3 })).toBe(false);
  });

  it("never crosses a lane of its own orientation", () => {
    expect(edgesCross(horizontal, { horizontal: true, row: 1, from: 1, to: 3 })).toBe(false);
  });

  it("is symmetric", () => {
    const vertical = { horizontal: false, col: 2, from: 0, to: 3 };
    expect(edgesCross(vertical, horizontal)).toBe(edgesCross(horizontal, vertical));
  });
});

describe("counting bridges at an island", () => {
  it("adds up every lane touching it", () => {
    const puzzle = linePuzzle();
    let state = emptyState(puzzle);
    expect(degree(puzzle, state, 1)).toBe(0);
    expect(remaining(puzzle, state, 1)).toBe(2);
    expect(islandStatus(puzzle, state, 1)).toBe(UNDER);

    state = withBridge(puzzle, state, edgeAtCells(puzzle, [0, 0], [2, 0]), 1);
    state = withBridge(puzzle, state, edgeAtCells(puzzle, [2, 0], [4, 0]), 1);
    expect(degree(puzzle, state, 1)).toBe(2);
    expect(remaining(puzzle, state, 1)).toBe(0);
    expect(islandStatus(puzzle, state, 1)).toBe(DONE);
  });

  it("counts a double bridge twice", () => {
    const puzzle = linePuzzle();
    const state = withBridge(puzzle, emptyState(puzzle), 0, 2);
    expect(state).toBe(null);
  });
});

describe("canPlace", () => {
  it("refuses a count that is not a whole number between zero and two", () => {
    const puzzle = ringPuzzle();
    const state = emptyState(puzzle);
    expect(canPlace(puzzle, state, 0, -1)).toBe(false);
    expect(canPlace(puzzle, state, 0, MAX_BRIDGES + 1)).toBe(false);
    expect(canPlace(puzzle, state, 0, 1.5)).toBe(false);
  });

  it("refuses an edge that does not exist", () => {
    const puzzle = ringPuzzle();
    expect(canPlace(puzzle, emptyState(puzzle), 999, 1)).toBe(false);
  });

  it("refuses to overshoot an island's number", () => {
    const puzzle = linePuzzle();
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    // The left island only needs one bridge.
    expect(canPlace(puzzle, emptyState(puzzle), edge, 1)).toBe(true);
    expect(canPlace(puzzle, emptyState(puzzle), edge, 2)).toBe(false);
  });

  it("always allows taking bridges away", () => {
    const puzzle = ringPuzzle();
    const state = withBridge(puzzle, emptyState(puzzle), 0, 2);
    expect(canPlace(puzzle, state, 0, 1)).toBe(true);
    expect(canPlace(puzzle, state, 0, 0)).toBe(true);
  });

  it("refuses a lane that a bridge already crosses", () => {
    const puzzle = crossingPuzzle();
    const across = edgeAtCells(puzzle, [0, 1], [2, 1]);
    const down = edgeAtCells(puzzle, [1, 0], [1, 2]);
    expect(edgesCross(puzzle.edges[across], puzzle.edges[down])).toBe(true);

    const state = withBridge(puzzle, emptyState(puzzle), across, 1);
    expect(isBlocked(puzzle, state, down)).toBe(true);
    expect(canPlace(puzzle, state, down, 1)).toBe(false);
    // Clearing the first lane frees the second again.
    const cleared = withBridge(puzzle, state, across, 0);
    expect(canPlace(puzzle, cleared, down, 1)).toBe(true);
  });
});

describe("nextCount", () => {
  it("walks none, one, two and back to none", () => {
    const puzzle = ringPuzzle();
    let state = emptyState(puzzle);
    expect(nextCount(puzzle, state, 0)).toBe(1);
    state = withBridge(puzzle, state, 0, 1);
    expect(nextCount(puzzle, state, 0)).toBe(2);
    state = withBridge(puzzle, state, 0, 2);
    expect(nextCount(puzzle, state, 0)).toBe(0);
  });

  it("skips a step the rules forbid", () => {
    const puzzle = linePuzzle();
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    let state = emptyState(puzzle);
    expect(nextCount(puzzle, state, edge)).toBe(1);
    state = withBridge(puzzle, state, edge, 1);
    // Two would overshoot the island that only needs one, so it wraps instead.
    expect(nextCount(puzzle, state, edge)).toBe(0);
  });

  it("leaves a lane alone when nothing about it may change", () => {
    const puzzle = crossingPuzzle();
    const across = edgeAtCells(puzzle, [0, 1], [2, 1]);
    const down = edgeAtCells(puzzle, [1, 0], [1, 2]);
    const state = withBridge(puzzle, emptyState(puzzle), across, 1);
    expect(nextCount(puzzle, state, down)).toBe(0);
  });
});

describe("withBridge", () => {
  it("returns a new array and leaves the old one alone", () => {
    const puzzle = ringPuzzle();
    const before = emptyState(puzzle);
    const after = withBridge(puzzle, before, 0, 1);
    expect(after).not.toBe(before);
    expect(before[0]).toBe(0);
    expect(after[0]).toBe(1);
  });

  it("returns null rather than an illegal board", () => {
    const puzzle = linePuzzle();
    expect(withBridge(puzzle, emptyState(puzzle), edgeAtCells(puzzle, [0, 0], [2, 0]), 2)).toBe(
      null
    );
  });
});

describe("edgeBetween", () => {
  it("finds the lane joining two islands whichever way round they are given", () => {
    const puzzle = linePuzzle();
    expect(edgeBetween(puzzle, 0, 1)).toBe(edgeBetween(puzzle, 1, 0));
    expect(edgeBetween(puzzle, 0, 1)).not.toBe(null);
  });

  it("answers null for a pair that is not joinable", () => {
    const puzzle = linePuzzle();
    expect(edgeBetween(puzzle, 0, 2)).toBe(null);
    expect(edgeBetween(puzzle, 99, 0)).toBe(null);
  });
});

describe("movesFrom", () => {
  it("lists every lane a tap would change, and which of them build", () => {
    const puzzle = ringPuzzle();
    const moves = movesFrom(puzzle, emptyState(puzzle), 0);
    expect(moves.length).toBe(2);
    for (const move of moves) {
      expect(move.count).toBe(0);
      expect(move.next).toBe(1);
      expect(move.buildable).toBe(true);
      expect(move.island).not.toBe(0);
    }
  });

  it("marks a lane that can only be cleared as not buildable", () => {
    const puzzle = linePuzzle();
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    const state = withBridge(puzzle, emptyState(puzzle), edge, 1);
    const move = movesFrom(puzzle, state, 0).find((entry) => entry.edgeId === edge);
    expect(move.next).toBe(0);
    expect(move.buildable).toBe(false);
  });

  it("leaves out a lane that cannot change at all", () => {
    const puzzle = crossingPuzzle();
    const across = edgeAtCells(puzzle, [0, 1], [2, 1]);
    const state = withBridge(puzzle, emptyState(puzzle), across, 1);
    const blockedIsland = puzzle.edges[edgeAtCells(puzzle, [1, 0], [1, 2])].a;
    const moves = movesFrom(puzzle, state, blockedIsland);
    expect(moves).toEqual([]);
  });
});

describe("isConnected", () => {
  it("is true for a single island", () => {
    const puzzle = buildPuzzle([{ col: 0, row: 0, required: 1 }], 1, 1);
    expect(isConnected(puzzle, emptyState(puzzle))).toBe(true);
  });

  it("is false while islands are still on their own", () => {
    const puzzle = linePuzzle();
    expect(isConnected(puzzle, emptyState(puzzle))).toBe(false);
  });

  it("becomes true once everything is joined up", () => {
    const puzzle = linePuzzle();
    let state = emptyState(puzzle);
    state = withBridge(puzzle, state, edgeAtCells(puzzle, [0, 0], [2, 0]), 1);
    expect(isConnected(puzzle, state)).toBe(false);
    state = withBridge(puzzle, state, edgeAtCells(puzzle, [2, 0], [4, 0]), 1);
    expect(isConnected(puzzle, state)).toBe(true);
  });
});

describe("finishing a board", () => {
  function solveRing(puzzle) {
    // The answer is the ring around the outside: everything but the middle rung.
    const middle = edgeAtCells(puzzle, [2, 0], [2, 2]);
    let state = emptyState(puzzle);
    for (const edge of puzzle.edges) {
      if (edge.id !== middle) {
        state = withBridge(puzzle, state, edge.id, 1);
      }
    }
    return state;
  }

  it("counts how many islands are finished as they fill up", () => {
    const puzzle = linePuzzle();
    let state = emptyState(puzzle);
    expect(satisfiedCount(puzzle, state)).toBe(0);
    state = withBridge(puzzle, state, edgeAtCells(puzzle, [0, 0], [2, 0]), 1);
    expect(satisfiedCount(puzzle, state)).toBe(1);
    state = withBridge(puzzle, state, edgeAtCells(puzzle, [2, 0], [4, 0]), 1);
    expect(satisfiedCount(puzzle, state)).toBe(3);
  });

  it("needs every number met and everything joined up", () => {
    const puzzle = ringPuzzle();
    const state = solveRing(puzzle);
    expect(allIslandsSatisfied(puzzle, state)).toBe(true);
    expect(isConnected(puzzle, state)).toBe(true);
    expect(isSolved(puzzle, state)).toBe(true);
    expect(isValidSolution(puzzle, state)).toBe(true);
  });

  it("is not solved while a number is unmet", () => {
    const puzzle = ringPuzzle();
    const state = emptyState(puzzle);
    expect(isSolved(puzzle, state)).toBe(false);
  });
});

describe("isValidSolution", () => {
  it("rejects an array of the wrong length, or no array at all", () => {
    const puzzle = linePuzzle();
    expect(isValidSolution(puzzle, [1])).toBe(false);
    expect(isValidSolution(puzzle, null)).toBe(false);
    expect(isValidSolution(puzzle, undefined)).toBe(false);
  });

  it("rejects counts that are not whole numbers in range", () => {
    const puzzle = linePuzzle();
    expect(isValidSolution(puzzle, [1, 3])).toBe(false);
    expect(isValidSolution(puzzle, [1, 1.5])).toBe(false);
    expect(isValidSolution(puzzle, [1, -1])).toBe(false);
  });

  it("rejects an answer whose bridges cross, even when the numbers add up", () => {
    const puzzle = crossingPuzzle();
    const across = edgeAtCells(puzzle, [0, 1], [2, 1]);
    const down = edgeAtCells(puzzle, [1, 0], [1, 2]);
    const state = emptyState(puzzle);
    state[across] = 2;
    state[down] = 2;
    // Every island reads two, and the board is "connected" in the graph sense.
    expect(allIslandsSatisfied(puzzle, state)).toBe(true);
    expect(isValidSolution(puzzle, state)).toBe(false);
  });
});

describe("cloneState", () => {
  it("copies the counts without sharing the array", () => {
    const puzzle = ringPuzzle();
    const state = withBridge(puzzle, emptyState(puzzle), 0, 1);
    const copy = cloneState(state);
    copy[0] = 0;
    expect(state[0]).toBe(1);
  });
});
