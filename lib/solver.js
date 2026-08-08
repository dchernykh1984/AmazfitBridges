// A complete Hashiwokakero solver, used by the generator to grade the boards it
// builds. Two properties make a board worth playing, and both are checked here:
// it has exactly one solution, and that solution can be reached without ever
// guessing. A board with two answers is not a logic puzzle, and a board that
// needs a guess is not one either - it is a coin flip with extra steps.
//
// The search branches on islands rather than on single bridges. An island's
// number fixes the total of its own bridges, so enumerating the combinations
// that add up to that number prunes far harder than trying 0, 1 and 2 on one
// edge at a time - most islands have only a handful of combinations, and many
// have exactly one.

import { MAX_BRIDGES } from "./puzzle.js";

// An unassigned edge is -1 rather than 0, because "no bridge here" and "not
// decided yet" prune very differently.
const UNASSIGNED = -1;

// Ceilings that keep a pathological board from freezing the watch. A search that
// stopped at the budget is reported as `exhausted`, and the caller (the
// generator) treats that as "cannot prove it, try another seed".
export const DEFAULT_SOLUTION_LIMIT = 2;
export const DEFAULT_NODE_BUDGET = 120000;

// The partially-decided board both searches work on. Bridge ends per island and
// undecided edges per island are maintained incrementally: recomputing them at
// every step is what turns a fast solver into a slow one.
function createBoard(puzzle, rules) {
  const useCrossings = rules === undefined || rules.crossings !== false;
  const useConnectivity = rules === undefined || rules.connectivity !== false;
  const islandCount = puzzle.islands.length;
  const required = puzzle.islands.map((island) => island.required);
  const values = new Array(puzzle.edges.length).fill(UNASSIGNED);
  const sums = new Array(islandCount).fill(0);
  const undecided = puzzle.edgesByIsland.map((edges) => edges.length);

  // The most bridges an undecided edge could still take: two, unless a bridge
  // already crosses it, or unless one of its islands has less room left.
  function capOf(edgeId) {
    if (values[edgeId] !== UNASSIGNED) {
      return values[edgeId];
    }
    if (useCrossings) {
      const crossing = puzzle.crossings[edgeId];
      for (let i = 0; i < crossing.length; i++) {
        if (values[crossing[i]] > 0) {
          return 0;
        }
      }
    }
    const edge = puzzle.edges[edgeId];
    return Math.min(MAX_BRIDGES, required[edge.a] - sums[edge.a], required[edge.b] - sums[edge.b]);
  }

  // An island is still satisfiable when it has not overshot its number and its
  // undecided edges could still make up the difference.
  function feasible(islandId) {
    if (sums[islandId] > required[islandId]) {
      return false;
    }
    let headroom = 0;
    const incident = puzzle.edgesByIsland[islandId];
    for (let i = 0; i < incident.length; i++) {
      if (values[incident[i]] === UNASSIGNED) {
        headroom += capOf(incident[i]);
      }
    }
    return sums[islandId] + headroom >= required[islandId];
  }

  // Both islands of every edge that crosses this one, plus this edge's own
  // islands, are the only ones a change here can affect.
  function neighbourhoodFeasible(edgeId) {
    const edge = puzzle.edges[edgeId];
    if (!feasible(edge.a) || !feasible(edge.b)) {
      return false;
    }
    const crossing = puzzle.crossings[edgeId];
    for (let i = 0; i < crossing.length; i++) {
      const other = puzzle.edges[crossing[i]];
      if (!feasible(other.a) || !feasible(other.b)) {
        return false;
      }
    }
    return true;
  }

  function assign(edgeId, value) {
    const edge = puzzle.edges[edgeId];
    values[edgeId] = value;
    sums[edge.a] += value;
    sums[edge.b] += value;
    undecided[edge.a] -= 1;
    undecided[edge.b] -= 1;
  }

  function unassign(edgeId) {
    const edge = puzzle.edges[edgeId];
    const value = values[edgeId];
    values[edgeId] = UNASSIGNED;
    sums[edge.a] -= value;
    sums[edge.b] -= value;
    undecided[edge.a] += 1;
    undecided[edge.b] += 1;
  }

  // The islands reachable from `startId` over bridges that are decided and
  // present. Used both for the final connectivity rule and for spotting a group
  // that has sealed itself off early.
  function reachableFrom(startId) {
    const seen = new Array(islandCount).fill(false);
    const stack = [startId];
    const group = [];
    seen[startId] = true;

    while (stack.length > 0) {
      const islandId = stack.pop();
      group.push(islandId);
      const incident = puzzle.edgesByIsland[islandId];
      for (let i = 0; i < incident.length; i++) {
        if (values[incident[i]] <= 0) {
          continue;
        }
        const edge = puzzle.edges[incident[i]];
        const other = edge.a === islandId ? edge.b : edge.a;
        if (!seen[other]) {
          seen[other] = true;
          stack.push(other);
        }
      }
    }
    return group;
  }

  // A group of islands that are all finished and have no undecided edges left
  // can never be joined to anything else. If it does not already contain every
  // island, this line of play can only ever produce a split board - the one rule
  // that a per-island count check cannot see.
  function isSealedOffGroup(startId) {
    // The prune exists to spot a board that can only end up split. With the
    // connectivity rule switched off a split board is a legal answer, so there
    // is nothing to prune.
    if (!useConnectivity) {
      return false;
    }
    const group = reachableFrom(startId);
    if (group.length === islandCount) {
      return false;
    }
    for (let i = 0; i < group.length; i++) {
      const islandId = group[i];
      if (undecided[islandId] > 0 || sums[islandId] !== required[islandId]) {
        return false;
      }
    }
    return true;
  }

  function isFullyConnected() {
    if (!useConnectivity) {
      return true;
    }
    return islandCount <= 1 || reachableFrom(0).length === islandCount;
  }

  // The legal ways to make up an island's remaining number out of its undecided
  // edges. Each one is a list of `{ edgeId, value }`.
  function combinationsFor(islandId) {
    const open = [];
    const caps = [];
    const incident = puzzle.edgesByIsland[islandId];
    for (let i = 0; i < incident.length; i++) {
      if (values[incident[i]] === UNASSIGNED) {
        open.push(incident[i]);
        caps.push(capOf(incident[i]));
      }
    }

    const found = [];
    const buffer = new Array(open.length).fill(0);
    forEachCombination(caps, 0, required[islandId] - sums[islandId], buffer, (assignment) => {
      found.push(open.map((edgeId, i) => ({ edgeId, value: assignment[i] })));
    });
    return found;
  }

  // Lay a whole combination down, undoing it again if any of its bridges leaves
  // a neighbouring island unsatisfiable. Reports whether it stuck.
  function applyCombination(combination) {
    let placed = 0;
    let ok = true;
    for (let i = 0; i < combination.length; i++) {
      const { edgeId, value } = combination[i];
      // Two edges of the same island never cross each other, but an earlier
      // choice in this same combination can still have blocked a later edge.
      if (value > 0 && capOf(edgeId) < value) {
        ok = false;
        break;
      }
      assign(edgeId, value);
      placed += 1;
      if (!neighbourhoodFeasible(edgeId)) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      for (let i = placed - 1; i >= 0; i--) {
        unassign(combination[i].edgeId);
      }
    }
    return ok;
  }

  // The combinations for an island that do not immediately contradict the board.
  //
  // A combination is dropped when laying it down leaves a neighbour
  // unsatisfiable, and - this is the connectivity rule working as a deduction
  // rather than as a final check - when it seals a group of islands off from the
  // rest. That is exactly the move a player rules out by saying "no, that would
  // close those three off on their own". Without it, every board whose answer
  // needs that argument looks like it needs a guess.
  function viableCombinationsFor(islandId) {
    const all = combinationsFor(islandId);
    const viable = [];
    for (let i = 0; i < all.length; i++) {
      if (!applyCombination(all[i])) {
        continue;
      }
      const sealed = isSealedOffGroup(islandId);
      undoCombination(all[i]);
      if (!sealed) {
        viable.push(all[i]);
      }
    }
    return viable;
  }

  function undoCombination(combination) {
    for (let i = combination.length - 1; i >= 0; i--) {
      unassign(combination[i].edgeId);
    }
  }

  return {
    islandCount,
    values,
    sums,
    undecided,
    required,
    applyCombination,
    combinationsFor,
    viableCombinationsFor,
    isFullyConnected,
    isSealedOffGroup,
    undoCombination,
  };
}

// Every way to hand out `need` bridge ends among the edges from `index` on,
// respecting each edge's ceiling. Written as an explicit recursion over a shared
// buffer: the combinations are consumed immediately, so building arrays for the
// branches that get pruned would be wasted work.
function forEachCombination(caps, index, need, buffer, visit) {
  if (need < 0) {
    return;
  }
  if (index === caps.length) {
    if (need === 0) {
      visit(buffer);
    }
    return;
  }
  // Nothing left can cover what is still needed.
  let headroom = 0;
  for (let i = index; i < caps.length; i++) {
    headroom += caps[i];
  }
  if (headroom < need) {
    return;
  }
  const cap = Math.min(caps[index], need);
  for (let value = 0; value <= cap; value++) {
    buffer[index] = value;
    forEachCombination(caps, index + 1, need - value, buffer, visit);
  }
  buffer[index] = 0;
}

// The island to branch on: the one with the fewest undecided edges, so the
// combination count stays small, breaking ties towards the tightest number.
function selectIsland(board) {
  let best = -1;
  let bestOpen = Infinity;
  let bestNeed = Infinity;
  for (let id = 0; id < board.islandCount; id++) {
    if (board.undecided[id] === 0) {
      continue;
    }
    const need = board.required[id] - board.sums[id];
    if (board.undecided[id] < bestOpen || (board.undecided[id] === bestOpen && need < bestNeed)) {
      best = id;
      bestOpen = board.undecided[id];
      bestNeed = need;
    }
  }
  return best;
}

// Solve the puzzle, counting solutions up to `limit`.
//
// `rules` can switch a rule off - `{ crossings: false }` or
// `{ connectivity: false }`. That is how the generator finds out whether a rule
// is doing any work on a board: solve without it, and if the answer stops being
// unique then the rule was what pinned it down. A board where every rule can be
// switched off without changing anything is arithmetic wearing a puzzle's hat.
//
// Returns `{ count, solution, nodes, exhausted }`: how many distinct solutions
// were found (capped at the limit), the first one as a bridge-count array, how
// many search nodes it took, and whether the search gave up on its node budget
// before finishing.
export function solvePuzzle(puzzle, options) {
  const settings = options || {};
  const limit = Number.isFinite(settings.limit)
    ? Math.max(1, settings.limit)
    : DEFAULT_SOLUTION_LIMIT;
  const budget = Number.isFinite(settings.maxNodes) ? settings.maxNodes : DEFAULT_NODE_BUDGET;

  const board = createBoard(puzzle, settings.rules);
  let count = 0;
  let solution = null;
  let nodes = 0;
  let exhausted = false;

  function search() {
    if (count >= limit || exhausted) {
      return;
    }
    nodes += 1;
    if (nodes > budget) {
      exhausted = true;
      return;
    }

    const islandId = selectIsland(board);
    if (islandId === -1) {
      // Nothing is undecided, and nothing survives the pruning unless every
      // island already carries its exact number, so only connectivity is left.
      if (board.isFullyConnected()) {
        if (solution === null) {
          solution = board.values.slice();
        }
        count += 1;
      }
      return;
    }

    const combinations = board.combinationsFor(islandId);
    for (let c = 0; c < combinations.length && count < limit && !exhausted; c++) {
      if (!board.applyCombination(combinations[c])) {
        continue;
      }
      if (!board.isSealedOffGroup(islandId)) {
        search();
      }
      board.undoCombination(combinations[c]);
    }
  }

  if (board.islandCount === 0) {
    return { count: 0, solution: null, nodes: 0, exhausted: false };
  }
  search();
  return { count, solution, nodes, exhausted };
}

// Whether the puzzle has exactly one solution. A search that ran out of budget
// answers "no", so an unprovable board is never shipped as a good one.
export function hasUniqueSolution(puzzle, maxNodes) {
  const result = solvePuzzle(puzzle, { limit: 2, maxNodes });
  return !result.exhausted && result.count === 1;
}

// Whether the board can be solved by pure deduction - repeatedly finding an
// island whose remaining bridges can only be arranged one way, counting the
// "that would seal a group off" argument as a deduction like any other - with no point
// at which the player has to pick between two possibilities and see what
// happens. This is the property that separates a fair Hashiwokakero board from
// one that has a unique answer you can only reach by trial and error, and it is
// what the generator actually ships on.
export function isForcedSolvable(puzzle) {
  const board = createBoard(puzzle);
  if (board.islandCount === 0) {
    return false;
  }

  for (;;) {
    let forced = null;
    for (let id = 0; id < board.islandCount && forced === null; id++) {
      if (board.undecided[id] === 0) {
        continue;
      }
      const combinations = board.viableCombinationsFor(id);
      if (combinations.length === 0) {
        // This island can no longer be satisfied at all: the board contradicts
        // itself, so there is nothing to deduce towards.
        return false;
      }
      if (combinations.length === 1) {
        forced = combinations[0];
      }
    }

    if (forced === null) {
      // Either everything is decided, or the next move needs a guess.
      return selectIsland(board) === -1 && board.isFullyConnected();
    }
    if (!board.applyCombination(forced)) {
      return false;
    }
  }
}
