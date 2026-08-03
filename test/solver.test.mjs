import { describe, it, expect } from "vitest";
import { buildPuzzle, isValidSolution } from "../lib/puzzle.js";
import {
  DEFAULT_NODE_BUDGET,
  DEFAULT_SOLUTION_LIMIT,
  hasUniqueSolution,
  isForcedSolvable,
  solvePuzzle,
} from "../lib/solver.js";
import {
  ambiguousPuzzle,
  crossingPuzzle,
  deadlockPuzzle,
  linePuzzle,
  ringPuzzle,
} from "./fixtures.mjs";

describe("solvePuzzle", () => {
  it("solves a board that is forced from end to end", () => {
    const puzzle = linePuzzle();
    const result = solvePuzzle(puzzle, { limit: 5 });
    expect(result.count).toBe(1);
    expect(result.exhausted).toBe(false);
    expect(isValidSolution(puzzle, result.solution)).toBe(true);
  });

  it("solves a board that needs a deduction across several islands", () => {
    const puzzle = ringPuzzle();
    const result = solvePuzzle(puzzle, { limit: 5 });
    expect(result.count).toBe(1);
    expect(isValidSolution(puzzle, result.solution)).toBe(true);
  });

  it("finds no answer when two required bridges would have to cross", () => {
    const result = solvePuzzle(deadlockPuzzle(), { limit: 5 });
    expect(result.count).toBe(0);
    expect(result.solution).toBe(null);
    expect(result.exhausted).toBe(false);
  });

  it("finds every answer a board really has", () => {
    const puzzle = ambiguousPuzzle();
    const result = solvePuzzle(puzzle, { limit: 10 });
    expect(result.count).toBe(2);
    expect(isValidSolution(puzzle, result.solution)).toBe(true);
  });

  it("stops counting at the limit it was given", () => {
    expect(solvePuzzle(ambiguousPuzzle(), { limit: 1 }).count).toBe(1);
  });

  it("defaults to looking for a second answer and no further", () => {
    expect(DEFAULT_SOLUTION_LIMIT).toBe(2);
    expect(solvePuzzle(ambiguousPuzzle()).count).toBe(2);
  });

  it("will not lay two bridges across each other to make the numbers work", () => {
    // Each of the four islands needs two bridges and has exactly one lane to
    // get them from, so both lanes would have to be doubled - and they cross.
    const puzzle = crossingPuzzle();
    expect(puzzle.crossings.some((list) => list.length > 0)).toBe(true);
    expect(solvePuzzle(puzzle, { limit: 20 }).count).toBe(0);
  });

  it("gives up rather than running forever, and says so", () => {
    const result = solvePuzzle(ambiguousPuzzle(), { limit: 10, maxNodes: 3 });
    expect(result.exhausted).toBe(true);
  });

  it("counts the work it did", () => {
    const result = solvePuzzle(ringPuzzle(), { limit: 5 });
    expect(result.nodes).toBeGreaterThan(0);
    expect(result.nodes).toBeLessThanOrEqual(DEFAULT_NODE_BUDGET);
  });

  it("has nothing to say about a board with no islands", () => {
    const result = solvePuzzle(buildPuzzle([], 5, 5));
    expect(result).toEqual({ count: 0, solution: null, nodes: 0, exhausted: false });
  });

  it("refuses an answer that leaves islands in separate groups", () => {
    // Four islands in two pairs far apart: the numbers can be met, but the two
    // pairs can never reach each other.
    const puzzle = buildPuzzle(
      [
        { col: 0, row: 0, required: 1 },
        { col: 2, row: 0, required: 1 },
        { col: 0, row: 3, required: 1 },
        { col: 2, row: 3, required: 1 },
      ],
      3,
      4
    );
    expect(solvePuzzle(puzzle, { limit: 5 }).count).toBe(0);
  });
});

describe("hasUniqueSolution", () => {
  it("accepts a board with exactly one answer", () => {
    expect(hasUniqueSolution(ringPuzzle())).toBe(true);
  });

  it("rejects a board with two", () => {
    expect(hasUniqueSolution(ambiguousPuzzle())).toBe(false);
  });

  it("rejects a board with none", () => {
    expect(hasUniqueSolution(deadlockPuzzle())).toBe(false);
  });

  it("rejects a board it could not finish thinking about", () => {
    expect(hasUniqueSolution(ringPuzzle(), 2)).toBe(false);
  });
});

describe("isForcedSolvable", () => {
  it("accepts a board where every step follows from the last", () => {
    expect(isForcedSolvable(linePuzzle())).toBe(true);
  });

  it("rejects a board whose single answer needs a guess to reach", () => {
    // The ring has exactly one answer, but no island on it is ever forced, so a
    // player can only get there by trying something and seeing what happens.
    expect(hasUniqueSolution(ringPuzzle())).toBe(true);
    expect(isForcedSolvable(ringPuzzle())).toBe(false);
  });

  it("rejects a board with no answer at all", () => {
    expect(isForcedSolvable(deadlockPuzzle())).toBe(false);
  });

  it("rejects a board with two answers", () => {
    expect(isForcedSolvable(ambiguousPuzzle())).toBe(false);
  });

  it("has nothing to say about a board with no islands", () => {
    expect(isForcedSolvable(buildPuzzle([], 3, 3))).toBe(false);
  });

  it("implies the answer is unique", () => {
    // Deduction that never has to choose cannot arrive at two different places.
    const puzzle = linePuzzle();
    expect(isForcedSolvable(puzzle)).toBe(true);
    expect(hasUniqueSolution(puzzle)).toBe(true);
  });
});
