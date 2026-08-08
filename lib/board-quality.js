// How interesting a board is, as something measurable.
//
// Correctness is a gate: a board either has one answer reachable without
// guessing or it is thrown away. Interest is not a gate but an ordering - the
// generator builds far more boards than it needs and keeps the best of them, so
// what matters here is being able to say which of two boards is the better one.
//
// The measure is deliberately not a weighted sum. Weights are invented numbers,
// and tuning them is the same guesswork as inventing thresholds, only harder to
// argue with afterwards. Instead the comparison is stepped: first how many of
// the game's rules actually do any work on this board, then how much room the
// crossing rule has, then how many loops there are, and only last a preference
// about the mix of single and double bridges.
//
// "Does a rule do any work" has an exact meaning: switch the rule off in the
// solver and see whether the answer stops being unique. If it does not, the rule
// was decoration on that board and the player never had to think about it.

import { solvePuzzle } from "./solver.js";

// What share of the bridges should be doubles for a board to feel varied. Boards
// drift towards all-doubles if nothing pulls the other way - that was measured at
// 88 per cent before the generator was changed - and a board of all doubles
// never asks the player to tell a one from a two.
export const IDEAL_DOUBLE_SHARE = 0.4;

// Whether the no-crossing rule is what pins the answer down.
export function crossingRuleMatters(puzzle, maxNodes) {
  const without = solvePuzzle(puzzle, { limit: 2, maxNodes, rules: { crossings: false } });
  return !without.exhausted && without.count > 1;
}

// Whether the "one connected group" rule is what pins the answer down.
export function connectivityRuleMatters(puzzle, maxNodes) {
  const without = solvePuzzle(puzzle, { limit: 2, maxNodes, rules: { connectivity: false } });
  return !without.exhausted && without.count > 1;
}

// Whether the board uses both kinds of bridge. A board with no double never
// exercises the "up to two" rule; a board with no single is solved by laying the
// maximum everywhere.
export function usesBothBridgeKinds(solution) {
  let singles = 0;
  let doubles = 0;
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === 1) {
      singles += 1;
    } else if (solution[i] === 2) {
      doubles += 1;
    }
  }
  return singles > 0 && doubles > 0;
}

export function doubleShare(solution) {
  let used = 0;
  let doubles = 0;
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] > 0) {
      used += 1;
      if (solution[i] === 2) {
        doubles += 1;
      }
    }
  }
  return used === 0 ? 0 : doubles / used;
}

// Loops in the answer. A tree has none, and a tree is the shape that makes the
// connectivity rule free: with no loop there is never a choice about which way
// round to join things up.
export function loopCount(puzzle, solution) {
  let used = 0;
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] > 0) {
      used += 1;
    }
  }
  return Math.max(0, used - puzzle.islands.length + 1);
}

// How many pairs of lanes could cross anywhere on this board. Not the same as
// the rule mattering - it is the room the rule has to work in, and it separates
// two boards that both happen to be pinned down without it.
export function crossingPairs(puzzle) {
  let pairs = 0;
  for (let i = 0; i < puzzle.crossings.length; i++) {
    pairs += puzzle.crossings[i].length;
  }
  return pairs / 2;
}

// Everything worth knowing about one board, in one pass.
export function measureBoard(puzzle, solution, maxNodes) {
  const crossings = crossingRuleMatters(puzzle, maxNodes);
  const connectivity = connectivityRuleMatters(puzzle, maxNodes);
  const bothKinds = usesBothBridgeKinds(solution);

  return {
    crossings,
    connectivity,
    bothKinds,
    // How many of the game's three rules the player actually has to use.
    rulesUsed: (crossings ? 1 : 0) + (connectivity ? 1 : 0) + (bothKinds ? 1 : 0),
    crossingPairs: crossingPairs(puzzle),
    loops: loopCount(puzzle, solution),
    doubleShare: doubleShare(solution),
  };
}

// Order two measured boards, best first. Stepped rather than summed: a board
// where more rules do work always beats one where fewer do, however pretty the
// loser is on the later measures.
export function compareBoards(a, b) {
  if (a.rulesUsed !== b.rulesUsed) {
    return b.rulesUsed - a.rulesUsed;
  }
  if (a.crossingPairs !== b.crossingPairs) {
    return b.crossingPairs - a.crossingPairs;
  }
  if (a.loops !== b.loops) {
    return b.loops - a.loops;
  }
  const driftA = Math.abs(a.doubleShare - IDEAL_DOUBLE_SHARE);
  const driftB = Math.abs(b.doubleShare - IDEAL_DOUBLE_SHARE);
  if (driftA !== driftB) {
    return driftA - driftB;
  }
  return 0;
}
