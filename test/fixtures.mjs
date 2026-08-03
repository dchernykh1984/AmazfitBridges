// Hand-checked boards the tests reason about. Each one is here because it pins
// down a rule that a randomly generated board would only exercise by accident.
import { buildPuzzle } from "../lib/puzzle.js";

// The two round screens the app builds for.
export const ROUND_SIZES = [466, 480];

// Three islands in a row: 1 - 2 - 1. Every step is forced, so it is the smallest
// board that is a real puzzle rather than a trick question.
export function linePuzzle() {
  return buildPuzzle(
    [
      { col: 0, row: 0, required: 1 },
      { col: 2, row: 0, required: 2 },
      { col: 4, row: 0, required: 1 },
    ],
    5,
    1
  );
}

// Six twos in two rows. It has exactly one answer - a ring around the outside
// with the middle rung empty - but reaching it needs a deduction that no single
// island forces on its own, which makes it the board that tells `isForcedSolvable`
// apart from `hasUniqueSolution`.
export function ringPuzzle() {
  return buildPuzzle(
    [
      { col: 0, row: 0, required: 2 },
      { col: 2, row: 0, required: 2 },
      { col: 4, row: 0, required: 2 },
      { col: 0, row: 2, required: 2 },
      { col: 2, row: 2, required: 2 },
      { col: 4, row: 2, required: 2 },
    ],
    5,
    3
  );
}

// A plus sign: the two twos can only reach each other straight through the two
// ones, and those two lanes cross. No answer exists, which is what the solver
// has to be able to say.
export function deadlockPuzzle() {
  return buildPuzzle(
    [
      { col: 1, row: 0, required: 2 },
      { col: 0, row: 1, required: 1 },
      { col: 2, row: 1, required: 1 },
      { col: 1, row: 2, required: 2 },
    ],
    3,
    3
  );
}

// A generated board that turned out to have two answers. Kept verbatim so the
// "exactly one solution" gate has something real to reject.
export function ambiguousPuzzle() {
  return buildPuzzle(
    [
      { col: 1, row: 0, required: 3 },
      { col: 3, row: 0, required: 3 },
      { col: 5, row: 0, required: 4 },
      { col: 1, row: 2, required: 4 },
      { col: 3, row: 2, required: 5 },
      { col: 5, row: 2, required: 4 },
      { col: 1, row: 5, required: 2 },
      { col: 3, row: 5, required: 3 },
    ],
    7,
    7
  );
}

// Two islands sharing a row with a third between them: the outer pair is not a
// legal pair, which is the whole of the "nothing in between" rule.
export function blockedRowPuzzle() {
  return buildPuzzle(
    [
      { col: 0, row: 0, required: 1 },
      { col: 2, row: 0, required: 2 },
      { col: 4, row: 0, required: 1 },
      { col: 2, row: 3, required: 1 },
    ],
    5,
    4
  );
}

// A horizontal lane and a vertical one that cross in open water, with all four
// islands able to afford either. Used to check that laying one bridge locks the
// other lane out.
export function crossingPuzzle() {
  return buildPuzzle(
    [
      { col: 1, row: 0, required: 2 },
      { col: 0, row: 1, required: 2 },
      { col: 2, row: 1, required: 2 },
      { col: 1, row: 2, required: 2 },
    ],
    3,
    3
  );
}

// The edge id joining two cells, for tests that want to talk about a lane by
// where it is rather than by the order buildPuzzle happened to find it in.
export function edgeAtCells(puzzle, first, second) {
  const idOf = (cell) =>
    puzzle.islands.findIndex((island) => island.col === cell[0] && island.row === cell[1]);
  const a = idOf(first);
  const b = idOf(second);
  return puzzle.edges.findIndex(
    (edge) => (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a)
  );
}
