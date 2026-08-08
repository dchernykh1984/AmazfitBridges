import { describe, it, expect } from "vitest";
import {
  compareBoards,
  connectivityRuleMatters,
  crossingPairs,
  crossingRuleMatters,
  doubleShare,
  IDEAL_DOUBLE_SHARE,
  loopCount,
  measureBoard,
  usesBothBridgeKinds,
} from "../lib/board-quality.js";
import { buildPuzzle, emptyState } from "../lib/puzzle.js";
import { unpackBoard } from "../lib/board-format.js";
import { BUILT_IN_BOARDS } from "../lib/boards.js";
import { LEVELS } from "../lib/levels.js";
import { solvePuzzle } from "../lib/solver.js";
import { crossingPuzzle, linePuzzle, ringPuzzle } from "./fixtures.mjs";

// A board off the shelf. Every shipped board is picked for making the player
// use the crossing rule, so the collection is the honest source of a fixture
// for that - and if this stops being true the test says so.
const SHIPPED = LEVELS[1];
function crossingBoard() {
  return buildPuzzle(unpackBoard(BUILT_IN_BOARDS[SHIPPED.id][0]), SHIPPED.cols, SHIPPED.rows);
}

describe("usesBothBridgeKinds", () => {
  it("is true only when the answer has a single and a double", () => {
    expect(usesBothBridgeKinds([1, 2, 0])).toBe(true);
    expect(usesBothBridgeKinds([1, 1, 0])).toBe(false);
    expect(usesBothBridgeKinds([2, 2, 2])).toBe(false);
    expect(usesBothBridgeKinds([0, 0])).toBe(false);
  });
});

describe("doubleShare", () => {
  it("is the share of the bridges that are doubles", () => {
    expect(doubleShare([1, 1, 2, 2])).toBe(0.5);
    expect(doubleShare([1, 1, 1, 1])).toBe(0);
    expect(doubleShare([2, 2])).toBe(1);
  });

  it("ignores lanes with no bridge on them", () => {
    expect(doubleShare([1, 0, 0, 2])).toBe(0.5);
  });

  it("is zero for an empty board rather than dividing by nothing", () => {
    expect(doubleShare([0, 0, 0])).toBe(0);
    expect(doubleShare([])).toBe(0);
  });
});

describe("loopCount", () => {
  it("is zero for an answer that is a tree", () => {
    const puzzle = linePuzzle();
    expect(loopCount(puzzle, [1, 1])).toBe(0);
  });

  it("counts the loops a ring closes", () => {
    // Six islands joined in a ring: six bridges over six islands is one loop.
    const puzzle = ringPuzzle();
    const solution = solvePuzzle(puzzle, { limit: 1 }).solution;
    expect(loopCount(puzzle, solution)).toBe(1);
  });

  it("never goes negative on a half-built board", () => {
    const puzzle = ringPuzzle();
    expect(loopCount(puzzle, emptyState(puzzle))).toBe(0);
  });
});

describe("crossingPairs", () => {
  it("counts each pair of lanes that could cross once", () => {
    expect(crossingPairs(crossingPuzzle())).toBe(1);
  });

  it("finds room for the rule on every shipped board", () => {
    expect(crossingPairs(crossingBoard())).toBeGreaterThan(0);
  });

  it("is zero on a board where nothing can cross", () => {
    expect(crossingPairs(linePuzzle())).toBe(0);
  });
});

describe("crossingRuleMatters", () => {
  it("is false when no two lanes can cross at all", () => {
    expect(crossingRuleMatters(linePuzzle(), 60000)).toBe(false);
  });

  it("is true when switching the rule off lets a second answer in", () => {
    const puzzle = crossingBoard();
    expect(solvePuzzle(puzzle, { limit: 2, maxNodes: SHIPPED.maxNodes }).count).toBe(1);
    expect(
      solvePuzzle(puzzle, { limit: 2, maxNodes: SHIPPED.maxNodes, rules: { crossings: false } })
        .count
    ).toBeGreaterThan(1);
    expect(crossingRuleMatters(puzzle, SHIPPED.maxNodes)).toBe(true);
  });
});

describe("connectivityRuleMatters", () => {
  it("is true when the numbers alone allow a board that falls apart", () => {
    // The ring is pinned down only by "all in one group": drop that and the
    // numbers admit several arrangements, most of them in pieces.
    const puzzle = ringPuzzle();
    expect(solvePuzzle(puzzle, { limit: 2 }).count).toBe(1);
    expect(solvePuzzle(puzzle, { limit: 9, rules: { connectivity: false } }).count).toBeGreaterThan(
      1
    );
    expect(connectivityRuleMatters(puzzle, 60000)).toBe(true);
  });

  it("is false when the numbers already pin every bridge down", () => {
    expect(connectivityRuleMatters(linePuzzle(), 60000)).toBe(false);
  });
});

describe("measureBoard", () => {
  it("counts how many of the three rules the player has to use", () => {
    const puzzle = crossingBoard();
    const solution = solvePuzzle(puzzle, { limit: 1, maxNodes: SHIPPED.maxNodes }).solution;
    const quality = measureBoard(puzzle, solution, SHIPPED.maxNodes);
    expect(quality.rulesUsed).toBe(
      (quality.crossings ? 1 : 0) + (quality.connectivity ? 1 : 0) + (quality.bothKinds ? 1 : 0)
    );
    expect(quality.crossings).toBe(true);
  });

  it("reports the plainest board as using barely any rule", () => {
    const puzzle = linePuzzle();
    const quality = measureBoard(puzzle, [1, 1], 60000);
    expect(quality.crossings).toBe(false);
    expect(quality.connectivity).toBe(false);
    expect(quality.bothKinds).toBe(false);
    expect(quality.rulesUsed).toBe(0);
  });
});

describe("compareBoards", () => {
  const board = (over) => ({
    rulesUsed: 1,
    crossingPairs: 0,
    loops: 0,
    doubleShare: IDEAL_DOUBLE_SHARE,
    ...over,
  });

  it("puts a board that uses more rules first, whatever else it is", () => {
    const many = board({ rulesUsed: 3, crossingPairs: 0, loops: 0, doubleShare: 1 });
    const few = board({ rulesUsed: 1, crossingPairs: 99, loops: 99 });
    expect(compareBoards(many, few)).toBeLessThan(0);
    expect(compareBoards(few, many)).toBeGreaterThan(0);
  });

  it("prefers more room for the crossing rule when the rule count ties", () => {
    expect(compareBoards(board({ crossingPairs: 5 }), board({ crossingPairs: 1 }))).toBeLessThan(0);
  });

  it("prefers more loops when the crossings tie", () => {
    expect(compareBoards(board({ loops: 3 }), board({ loops: 0 }))).toBeLessThan(0);
  });

  it("prefers a mix of single and double bridges when all else ties", () => {
    const balanced = board({ doubleShare: IDEAL_DOUBLE_SHARE });
    const allDoubles = board({ doubleShare: 1 });
    expect(compareBoards(balanced, allDoubles)).toBeLessThan(0);
  });

  it("calls two identical boards equal, so sorting stays stable", () => {
    expect(compareBoards(board({}), board({}))).toBe(0);
  });

  it("sorts a list best first", () => {
    const list = [
      board({ rulesUsed: 1 }),
      board({ rulesUsed: 3 }),
      board({ rulesUsed: 2, loops: 4 }),
      board({ rulesUsed: 2, loops: 1 }),
    ];
    const order = list.slice().sort(compareBoards);
    expect(order.map((entry) => entry.rulesUsed)).toEqual([3, 2, 2, 1]);
    expect(order[1].loops).toBe(4);
  });
});
