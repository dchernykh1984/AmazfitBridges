// The Hashiwokakero rule set, as plain data and pure functions with no Zepp OS
// dependency, so every rule is exercised by unit tests rather than by squinting
// at a watch. The page owns pixels and input; this module owns truth.
//
// The rules (see en.wikipedia.org/wiki/Hashiwokakero): islands carry a number,
// bridges run only horizontally or vertically between two islands with nothing
// in between, at most two bridges join the same pair, bridges never cross each
// other, every island ends up with exactly as many bridge ends as its number,
// and the finished bridges join every island into one connected group.
//
// A puzzle is immutable: the islands, the pairs they *could* be joined by, and
// which of those pairs would cross. The bridges themselves live in a separate
// "state" array of one count (0, 1 or 2) per edge, so undo is a matter of
// keeping old arrays rather than replaying moves.

export const MAX_BRIDGES = 2;

// The largest number an island may carry: four directions, two bridges each.
export const MAX_REQUIRED = 8;

export const UNDER = "under";
export const DONE = "done";

// Islands sort top-to-bottom then left-to-right, so ids are stable for a given
// set of positions no matter what order the generator produced them in. That is
// what makes a generated puzzle reproducible from its seed.
function compareIslands(a, b) {
  return a.row === b.row ? a.col - b.col : a.row - b.row;
}

// Every pair of islands that share a row or a column with no island between
// them. Walking each row and each column in sorted order yields exactly the
// consecutive pairs, which is exactly the adjacency the rules allow, and yields
// each pair once.
function findEdges(islands) {
  const edges = [];
  const rows = new Map();
  const columns = new Map();

  for (const island of islands) {
    if (!rows.has(island.row)) {
      rows.set(island.row, []);
    }
    rows.get(island.row).push(island);
    if (!columns.has(island.col)) {
      columns.set(island.col, []);
    }
    columns.get(island.col).push(island);
  }

  for (const line of rows.values()) {
    line.sort((a, b) => a.col - b.col);
    for (let i = 1; i < line.length; i++) {
      edges.push({
        id: edges.length,
        a: line[i - 1].id,
        b: line[i].id,
        horizontal: true,
        row: line[i].row,
        from: line[i - 1].col,
        to: line[i].col,
      });
    }
  }

  for (const line of columns.values()) {
    line.sort((a, b) => a.row - b.row);
    for (let i = 1; i < line.length; i++) {
      edges.push({
        id: edges.length,
        a: line[i - 1].id,
        b: line[i].id,
        horizontal: false,
        col: line[i].col,
        from: line[i - 1].row,
        to: line[i].row,
      });
    }
  }

  return edges;
}

// A horizontal edge and a vertical one cross when the vertical one's column
// falls strictly inside the horizontal one's span and vice versa. Strictly,
// because a shared endpoint is an island, and an island is never in the middle
// of an edge: an island between two others splits them into two edges instead.
export function edgesCross(first, second) {
  if (first.horizontal === second.horizontal) {
    return false;
  }
  const horizontal = first.horizontal ? first : second;
  const vertical = first.horizontal ? second : first;
  return (
    horizontal.from < vertical.col &&
    vertical.col < horizontal.to &&
    vertical.from < horizontal.row &&
    horizontal.row < vertical.to
  );
}

// Compile a list of `{ col, row, required }` into the immutable puzzle the rest
// of the game reads. Islands are renumbered into reading order; edges and the
// crossing table are derived once here so no hot path recomputes them.
export function buildPuzzle(rawIslands, cols, rows) {
  const islands = rawIslands
    .map((island) => ({
      col: Math.floor(island.col),
      row: Math.floor(island.row),
      required: Math.floor(island.required),
    }))
    .sort(compareIslands)
    .map((island, id) => ({ ...island, id }));

  const edges = findEdges(islands);

  const edgesByIsland = islands.map(() => []);
  for (const edge of edges) {
    edgesByIsland[edge.a].push(edge.id);
    edgesByIsland[edge.b].push(edge.id);
  }

  const crossings = edges.map(() => []);
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (edgesCross(edges[i], edges[j])) {
        crossings[i].push(j);
        crossings[j].push(i);
      }
    }
  }

  return {
    cols: Math.max(1, Math.floor(cols)),
    rows: Math.max(1, Math.floor(rows)),
    islands,
    edges,
    edgesByIsland,
    crossings,
    total: islands.reduce((sum, island) => sum + island.required, 0) / 2,
  };
}

export function emptyState(puzzle) {
  return puzzle.edges.map(() => 0);
}

export function cloneState(state) {
  return state.slice();
}

// How many bridge ends the island currently has.
export function degree(puzzle, state, islandId) {
  let sum = 0;
  const incident = puzzle.edgesByIsland[islandId];
  for (let i = 0; i < incident.length; i++) {
    sum += state[incident[i]];
  }
  return sum;
}

// How many bridge ends the island still needs. Never negative, because no move
// that would overshoot is ever accepted.
export function remaining(puzzle, state, islandId) {
  return puzzle.islands[islandId].required - degree(puzzle, state, islandId);
}

export function islandStatus(puzzle, state, islandId) {
  return remaining(puzzle, state, islandId) === 0 ? DONE : UNDER;
}

// Whether a bridge already laid across this one rules it out. Checked before
// every placement, which is how "bridges must not cross" is enforced.
export function isBlocked(puzzle, state, edgeId) {
  const crossing = puzzle.crossings[edgeId];
  for (let i = 0; i < crossing.length; i++) {
    if (state[crossing[i]] > 0) {
      return true;
    }
  }
  return false;
}

// Whether the edge may hold exactly `count` bridges given everything else on
// the board. Removing is always allowed; adding must fit under both islands'
// numbers and must not cross a bridge that is already there.
export function canPlace(puzzle, state, edgeId, count) {
  if (!Number.isInteger(count) || count < 0 || count > MAX_BRIDGES) {
    return false;
  }
  const edge = puzzle.edges[edgeId];
  if (edge === undefined) {
    return false;
  }
  const delta = count - state[edgeId];
  if (delta > 0) {
    if (remaining(puzzle, state, edge.a) < delta || remaining(puzzle, state, edge.b) < delta) {
      return false;
    }
  }
  if (count > 0 && isBlocked(puzzle, state, edgeId)) {
    return false;
  }
  return true;
}

// The most bridges this edge could take right now, used to grey out a pair that
// has no move left.
export function maxCountFor(puzzle, state, edgeId) {
  for (let count = MAX_BRIDGES; count > 0; count--) {
    if (canPlace(puzzle, state, edgeId, count)) {
      return count;
    }
  }
  return 0;
}

// A new state with the edge set to `count`, or null when that is not allowed.
// States are copied rather than mutated so the undo stack can just keep the old
// one; a board has a few dozen edges, so the copy is cheap.
export function withBridge(puzzle, state, edgeId, count) {
  if (!canPlace(puzzle, state, edgeId, count)) {
    return null;
  }
  const next = cloneState(state);
  next[edgeId] = count;
  return next;
}

// The count one tap gives: none, one, two and back to none, skipping any step
// the rules forbid. Tapping a pair that has no legal change at all leaves it
// alone rather than silently doing nothing surprising elsewhere.
export function nextCount(puzzle, state, edgeId) {
  const current = state[edgeId];
  for (let step = 1; step <= MAX_BRIDGES; step++) {
    const candidate = (current + step) % (MAX_BRIDGES + 1);
    if (canPlace(puzzle, state, edgeId, candidate)) {
      return candidate;
    }
  }
  return current;
}

// The edge joining two islands, or null when they are not a legal pair.
export function edgeBetween(puzzle, first, second) {
  const incident = puzzle.edgesByIsland[first];
  if (incident === undefined) {
    return null;
  }
  for (let i = 0; i < incident.length; i++) {
    const edge = puzzle.edges[incident[i]];
    if (edge.a === second || edge.b === second) {
      return edge.id;
    }
  }
  return null;
}

// The islands this one can still be joined to, with the count a tap would set.
// The page uses it to show where the selected island may go next.
export function movesFrom(puzzle, state, islandId) {
  const moves = [];
  const incident = puzzle.edgesByIsland[islandId];
  for (let i = 0; i < incident.length; i++) {
    const edgeId = incident[i];
    const edge = puzzle.edges[edgeId];
    const next = nextCount(puzzle, state, edgeId);
    if (next !== state[edgeId]) {
      moves.push({
        edgeId,
        island: edge.a === islandId ? edge.b : edge.a,
        count: state[edgeId],
        next,
        // A tap that adds a bridge is worth hinting at on screen; one that only
        // takes the pair back round to nothing is not.
        buildable: next > state[edgeId],
      });
    }
  }
  return moves;
}

// Whether the bridges laid so far join every island into one group. Islands
// with no bridge at all count as their own group, so a half-built board is
// correctly "not connected" - only the final check cares, but the page also
// uses it to hint at a finished-but-split board.
export function isConnected(puzzle, state) {
  const count = puzzle.islands.length;
  if (count <= 1) {
    return true;
  }
  const seen = new Array(count).fill(false);
  const stack = [0];
  seen[0] = true;
  let visited = 1;

  while (stack.length > 0) {
    const islandId = stack.pop();
    const incident = puzzle.edgesByIsland[islandId];
    for (let i = 0; i < incident.length; i++) {
      const edgeId = incident[i];
      if (state[edgeId] === 0) {
        continue;
      }
      const edge = puzzle.edges[edgeId];
      const other = edge.a === islandId ? edge.b : edge.a;
      if (!seen[other]) {
        seen[other] = true;
        visited += 1;
        stack.push(other);
      }
    }
  }

  return visited === count;
}

// Whether every island carries exactly its number of bridges. Cheaper than the
// full solved check and enough to tell "keep going" from "you are one
// connectivity mistake away".
export function allIslandsSatisfied(puzzle, state) {
  for (let id = 0; id < puzzle.islands.length; id++) {
    if (remaining(puzzle, state, id) !== 0) {
      return false;
    }
  }
  return true;
}

export function isSolved(puzzle, state) {
  return allIslandsSatisfied(puzzle, state) && isConnected(puzzle, state);
}

// A full audit of a bridge-count array against every rule, including the two the
// game itself can never break because it refuses the move: an over-long bridge
// and a crossing. The generator checks its own output with this, so a layout bug
// cannot ship a board whose "answer" is not actually legal.
export function isValidSolution(puzzle, state) {
  if (!Array.isArray(state) || state.length !== puzzle.edges.length) {
    return false;
  }
  for (let edgeId = 0; edgeId < state.length; edgeId++) {
    const count = state[edgeId];
    if (!Number.isInteger(count) || count < 0 || count > MAX_BRIDGES) {
      return false;
    }
    if (count > 0 && isBlocked(puzzle, state, edgeId)) {
      return false;
    }
  }
  return isSolved(puzzle, state);
}

// How many islands already carry their full number, for the on-screen progress
// readout.
export function satisfiedCount(puzzle, state) {
  let count = 0;
  for (let id = 0; id < puzzle.islands.length; id++) {
    if (remaining(puzzle, state, id) === 0) {
      count += 1;
    }
  }
  return count;
}
