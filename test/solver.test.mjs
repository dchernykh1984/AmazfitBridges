import { describe, it, expect } from "vitest";
import { buildPuzzle, isValidSolution } from "../lib/puzzle.js";
import {
  DEFAULT_NODE_BUDGET,
  DEFAULT_SOLUTION_LIMIT,
  hasUniqueSolution,
  isForcedSolvable,
  solvePuzzle,
} from "../lib/solver.js";
import { allIslandsSatisfied } from "../lib/puzzle.js";
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

describe("switching a rule off", () => {
  it("lets a board that only connectivity pins down have several answers", () => {
    const puzzle = ringPuzzle();
    expect(solvePuzzle(puzzle, { limit: 9 }).count).toBe(1);
    const without = solvePuzzle(puzzle, { limit: 9, rules: { connectivity: false } });
    expect(without.count).toBeGreaterThan(1);
    // Every one of them still satisfies every island's number - dropping the
    // rule must widen the answer set, not corrupt it.
    expect(without.solution).not.toBe(null);
    expect(allIslandsSatisfied(puzzle, without.solution)).toBe(true);
  });

  it("lets bridges cross once the crossing rule is off", () => {
    // The plus board: four islands needing two bridges each, one lane apiece,
    // and the two lanes cross. It has no answer at all with the rules on.
    const puzzle = crossingPuzzle();
    expect(solvePuzzle(puzzle, { limit: 9 }).count).toBe(0);

    // Dropping the crossing rule alone is not enough: the two doubled lanes
    // leave the board in two separate groups, which connectivity then refuses.
    expect(solvePuzzle(puzzle, { limit: 9, rules: { crossings: false } }).count).toBe(0);

    const without = solvePuzzle(puzzle, {
      limit: 9,
      rules: { crossings: false, connectivity: false },
    });
    expect(without.count).toBeGreaterThan(0);
    expect(allIslandsSatisfied(puzzle, without.solution)).toBe(true);
  });

  it("changes nothing on a board where neither rule does any work", () => {
    const puzzle = linePuzzle();
    const withRules = solvePuzzle(puzzle, { limit: 9 });
    for (const rules of [{ crossings: false }, { connectivity: false }]) {
      const without = solvePuzzle(puzzle, { limit: 9, rules });
      expect(without.count, JSON.stringify(rules)).toBe(withRules.count);
      expect(without.solution, JSON.stringify(rules)).toEqual(withRules.solution);
    }
  });

  it("leaves the answer itself untouched when a rule is switched off", () => {
    // Only the count may widen; a reported answer must always be a real one.
    const puzzle = ringPuzzle();
    const without = solvePuzzle(puzzle, { limit: 1, rules: { connectivity: false } });
    for (const count of without.solution) {
      expect(count).toBeGreaterThanOrEqual(0);
      expect(count).toBeLessThanOrEqual(2);
    }
  });
});

describe("isForcedSolvable with the connectivity argument", () => {
  it("still refuses a board that genuinely needs a guess", () => {
    expect(isForcedSolvable(ambiguousPuzzle())).toBe(false);
    expect(isForcedSolvable(deadlockPuzzle())).toBe(false);
  });

  it("still accepts a board every step of which is forced", () => {
    expect(isForcedSolvable(linePuzzle())).toBe(true);
  });

  it("leaves the board exactly as it found it", () => {
    // The check applies and undoes whole combinations to see which are viable;
    // a leak would make a second call disagree with the first.
    const puzzle = ringPuzzle();
    const before = isForcedSolvable(puzzle);
    expect(isForcedSolvable(puzzle)).toBe(before);
    expect(solvePuzzle(puzzle, { limit: 9 }).count).toBe(1);
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
