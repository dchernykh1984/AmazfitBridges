// Puzzle generation. Boards are built, not searched for: start from one island
// and repeatedly throw a bridge out to a fresh island, which makes the answer
// known by construction and guarantees the finished layout is connected. The
// numbers on the islands are then simply how many bridge ends each one ended up
// with.
//
// Building a solvable board is the easy half. A *good* board also has exactly
// one solution, and construction alone does not give that, so each candidate is
// handed to the solver and rejected if a second answer exists. Rejections are
// cheap - a new seed and another go - and the retry budget keeps the watch from
// thinking for longer than the "generating" screen is worth looking at.

import { buildPuzzle, edgeBetween, isValidSolution, MAX_BRIDGES, MAX_REQUIRED } from "./puzzle.js";
import { hasUniqueSolution, isForcedSolvable } from "./solver.js";
import { createRandom, normalizeSeed, randomInt, shuffle } from "./rng.js";

const DIRECTIONS = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

// The shortest a bridge may be. Two islands in neighbouring cells leave no room
// to draw anything between them, so they are never both placed.
const MIN_SPAN = 2;

function cellKey(cols, col, row) {
  return row * cols + col;
}

function pairKey(a, b) {
  return a < b ? a + ":" + b : b + ":" + a;
}

function createGrid(cols, rows) {
  return {
    cols,
    rows,
    // cell -> island id, and cell -> the pair whose bridge runs over it. Bridge
    // ownership matters: a second bridge may share a lane with the first one of
    // the same pair, but never with anybody else's.
    islands: new Map(),
    bridges: new Map(),
    points: [],
    degrees: [],
    links: new Map(),
  };
}

function addIsland(grid, col, row) {
  const id = grid.points.length;
  grid.points.push({ col, row });
  grid.degrees.push(0);
  grid.islands.set(cellKey(grid.cols, col, row), id);
  return id;
}

function addBridges(grid, from, to, amount) {
  const key = pairKey(from, to);
  grid.links.set(key, (grid.links.get(key) || 0) + amount);
  grid.degrees[from] += amount;
  grid.degrees[to] += amount;
}

function markSpan(grid, col, row, dc, dr, distance, owner) {
  for (let step = 1; step < distance; step++) {
    grid.bridges.set(cellKey(grid.cols, col + dc * step, row + dr * step), owner);
  }
}

// A cell can host a new island when it is on the board, empty, not already
// spanned by a bridge, and not touching another island - see MIN_SPAN.
function canHostIsland(grid, col, row) {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) {
    return false;
  }
  const key = cellKey(grid.cols, col, row);
  if (grid.islands.has(key) || grid.bridges.has(key)) {
    return false;
  }
  for (let i = 0; i < DIRECTIONS.length; i++) {
    const near = cellKey(grid.cols, col + DIRECTIONS[i].dc, row + DIRECTIONS[i].dr);
    if (grid.islands.has(near)) {
      return false;
    }
  }
  return true;
}

// Whether the cells strictly between two points on a line are free of islands
// and of other bridges. Bridges laid here later cannot break this one, because
// its own cells are marked as taken the moment it is built.
function spanIsClear(grid, col, row, dc, dr, distance) {
  for (let step = 1; step < distance; step++) {
    const key = cellKey(grid.cols, col + dc * step, row + dr * step);
    if (grid.islands.has(key) || grid.bridges.has(key)) {
      return false;
    }
  }
  return true;
}

// The first island in a direction, how far away it is, and which pairs' bridges
// lie in the way. Stops at the board edge or once the reach is used up.
function scanForIsland(grid, from, dc, dr, maxSpan) {
  const blockedBy = new Set();
  for (let step = 1; step <= maxSpan; step++) {
    const col = from.col + dc * step;
    const row = from.row + dr * step;
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) {
      return null;
    }
    const key = cellKey(grid.cols, col, row);
    const island = grid.islands.get(key);
    if (island !== undefined) {
      return { id: island, distance: step, blockedBy };
    }
    const owner = grid.bridges.get(key);
    if (owner !== undefined) {
      blockedBy.add(owner);
    }
  }
  return null;
}

// Grow the layout one island at a time. Each round picks an island that still
// has room, a direction and a distance, and - if the way is clear - drops a new
// island there and bridges the two. Islands are tried least-connected first, in
// shuffled order within a tie, so the board spreads out instead of clustering
// around whichever island the loop happens to favour.
function growIslands(grid, config, random) {
  while (grid.points.length < config.islands) {
    const order = shuffle(
      random,
      Array.from({ length: grid.points.length }, (_, id) => id)
    ).sort((a, b) => grid.degrees[a] - grid.degrees[b]);

    let placed = false;
    for (let i = 0; i < order.length && !placed; i++) {
      const fromId = order[i];
      if (grid.degrees[fromId] >= MAX_REQUIRED) {
        continue;
      }
      const from = grid.points[fromId];
      const directions = shuffle(random, DIRECTIONS);

      for (let d = 0; d < directions.length && !placed; d++) {
        const { dc, dr } = directions[d];
        const spans = shuffle(
          random,
          Array.from({ length: config.maxSpan - MIN_SPAN + 1 }, (_, k) => MIN_SPAN + k)
        );

        for (let s = 0; s < spans.length && !placed; s++) {
          const distance = spans[s];
          const col = from.col + dc * distance;
          const row = from.row + dr * distance;
          if (!canHostIsland(grid, col, row)) {
            continue;
          }
          if (!spanIsClear(grid, from.col, from.row, dc, dr, distance)) {
            continue;
          }

          const room = Math.min(MAX_BRIDGES, MAX_REQUIRED - grid.degrees[fromId]);
          const amount = room >= MAX_BRIDGES && random() < config.doubleChance ? MAX_BRIDGES : 1;
          const toId = addIsland(grid, col, row);
          markSpan(grid, from.col, from.row, dc, dr, distance, pairKey(fromId, toId));
          addBridges(grid, fromId, toId, amount);
          placed = true;
        }
      }
    }

    // Nothing fits anywhere: the board is as big as this layout will get.
    if (!placed) {
      return;
    }
  }
}

// Extra bridges between islands that are already on the board. Without them the
// answer is a tree, and a tree is a much softer puzzle: every leaf is forced.
// These close loops, which is where the interesting deductions come from.
function addExtraBridges(grid, config, random) {
  for (let attempt = 0; attempt < config.extraBridges; attempt++) {
    const fromId = randomInt(random, grid.points.length);
    const from = grid.points[fromId];
    const directions = shuffle(random, DIRECTIONS);

    for (let d = 0; d < directions.length; d++) {
      const { dc, dr } = directions[d];
      const target = scanForIsland(grid, from, dc, dr, config.maxSpan);
      if (target === null || target.distance < MIN_SPAN) {
        continue;
      }

      const key = pairKey(fromId, target.id);
      const existing = grid.links.get(key) || 0;
      if (existing >= MAX_BRIDGES) {
        continue;
      }
      if (grid.degrees[fromId] >= MAX_REQUIRED || grid.degrees[target.id] >= MAX_REQUIRED) {
        continue;
      }
      // Doubling an existing bridge reuses its own lane; a brand new one needs
      // an empty lane.
      const foreign = Array.from(target.blockedBy).some((owner) => owner !== key);
      if (foreign || (existing === 0 && target.blockedBy.size > 0)) {
        continue;
      }

      if (existing === 0) {
        markSpan(grid, from.col, from.row, dc, dr, target.distance, key);
      }
      addBridges(grid, fromId, target.id, 1);
      break;
    }
  }
}

// Turn the grown layout into a puzzle plus the bridge-count array that solves
// it. buildPuzzle renumbers islands into reading order, so the built bridges are
// looked up again by position rather than by the ids used while growing.
function compile(grid) {
  const rawIslands = grid.points.map((point, id) => ({
    col: point.col,
    row: point.row,
    required: grid.degrees[id],
  }));
  const puzzle = buildPuzzle(rawIslands, grid.cols, grid.rows);

  const idByCell = new Map();
  for (const island of puzzle.islands) {
    idByCell.set(cellKey(grid.cols, island.col, island.row), island.id);
  }
  const idOf = (pointId) =>
    idByCell.get(cellKey(grid.cols, grid.points[pointId].col, grid.points[pointId].row));

  const solution = puzzle.edges.map(() => 0);
  for (const [key, amount] of grid.links) {
    const parts = key.split(":");
    const edgeId = edgeBetween(puzzle, idOf(Number(parts[0])), idOf(Number(parts[1])));
    if (edgeId === null) {
      return null;
    }
    solution[edgeId] = amount;
  }

  return { puzzle, solution };
}

// One candidate board from one seed. Returns null when the layout came out too
// small or somehow inconsistent, which the caller answers with another seed.
export function generateCandidate(config, seed) {
  const random = createRandom(seed);
  const grid = createGrid(config.cols, config.rows);

  // Start near the middle so the board grows outwards in every direction
  // instead of hugging whichever corner the first draw landed in.
  const startCol = Math.floor(config.cols / 4) + randomInt(random, Math.max(1, config.cols / 2));
  const startRow = Math.floor(config.rows / 4) + randomInt(random, Math.max(1, config.rows / 2));
  addIsland(grid, startCol, startRow);

  growIslands(grid, config, random);
  if (grid.points.length < config.minIslands) {
    return null;
  }
  addExtraBridges(grid, config, random);

  const compiled = compile(grid);
  if (compiled === null || !isValidSolution(compiled.puzzle, compiled.solution)) {
    return null;
  }
  return compiled;
}

// A playable board for the given difficulty. Candidates are generated from
// seeds derived from the one given until one of them passes both quality gates:
// exactly one solution, and a solution reachable by deduction alone. Building a
// board is far cheaper than proving it, and most candidates pass, so the retry
// budget is rarely touched.
//
// If nothing passes, the last valid candidate is played anyway. A board that is
// merely solvable is a worse puzzle than one that is provably fair, but it is a
// far better watch face than an error message.
export function generatePuzzle(config, seed) {
  const base = normalizeSeed(seed);
  let fallback = null;

  for (let attempt = 0; attempt < config.attempts; attempt++) {
    const attemptSeed = normalizeSeed(base + attempt * 0x9e3779b1);
    const candidate = generateCandidate(config, attemptSeed);
    if (candidate === null) {
      continue;
    }
    if (fallback === null) {
      fallback = { ...candidate, seed: attemptSeed, unique: false, fair: false };
    }

    if (
      hasUniqueSolution(candidate.puzzle, config.maxNodes) &&
      isForcedSolvable(candidate.puzzle)
    ) {
      return { ...candidate, seed: attemptSeed, unique: true, fair: true };
    }
  }

  return fallback;
}
