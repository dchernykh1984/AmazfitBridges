// Where the board lives in pixels, and what the player hit when they tapped.
// Everything here is in "world" coordinates - the whole map, not the part of it
// currently on screen - so it is free of the camera and free of Zepp OS, and
// therefore unit tested. The page converts world to screen with lib/camera.js.

// Cell and island sizes as fractions of the screen's diameter. A cell a little
// under an eighth of the screen puts roughly eight columns across a round watch
// and leaves the numbers big enough to read without leaning in.
const CELL_RATIO = 0.117;
const ISLAND_RATIO = 0.36;
const BRIDGE_RATIO = 0.075;
const BRIDGE_GAP_RATIO = 0.12;
const NUMBER_RATIO = 0.46;

// How far past an island's edge a tap still counts as hitting it. Fingers are
// wider than islands, and missing a tap on a watch is far more annoying than
// occasionally hitting the wrong thing.
const TAP_SLACK_RATIO = 0.22;

// How far from the centre line of a bridge a tap still counts as hitting it.
const BRIDGE_TAP_RATIO = 0.3;

// The pixel sizes for a board of `cols` x `rows` cells on a screen of the given
// diameter. Every size is derived from the screen so the same layout code works
// on a 466px watch and a 480px one.
export function createLayout(screenSize, cols, rows) {
  const cell = Math.max(8, Math.round(screenSize * CELL_RATIO));
  const columns = Math.max(1, Math.floor(cols));
  const lines = Math.max(1, Math.floor(rows));
  return {
    cell,
    cols: columns,
    rows: lines,
    radius: Math.round(cell * ISLAND_RATIO),
    bridge: Math.max(2, Math.round(cell * BRIDGE_RATIO)),
    bridgeGap: Math.max(2, Math.round(cell * BRIDGE_GAP_RATIO)),
    numberSize: Math.round(cell * NUMBER_RATIO),
    tapSlack: Math.round(cell * TAP_SLACK_RATIO),
    bridgeTap: Math.round(cell * BRIDGE_TAP_RATIO),
    width: columns * cell,
    height: lines * cell,
  };
}

// The world-pixel centre of a grid cell. Islands sit in the middle of their
// cell, which is what leaves room for a bridge to run between two of them.
export function cellCenter(layout, col, row) {
  return {
    x: Math.round((col + 0.5) * layout.cell),
    y: Math.round((row + 0.5) * layout.cell),
  };
}

export function islandCenter(layout, island) {
  return cellCenter(layout, island.col, island.row);
}

// The line a bridge would be drawn along, from the edge of one island to the
// edge of the other, so the bridge does not disappear under the discs.
export function edgeLine(layout, puzzle, edgeId) {
  const edge = puzzle.edges[edgeId];
  const a = islandCenter(layout, puzzle.islands[edge.a]);
  const b = islandCenter(layout, puzzle.islands[edge.b]);
  if (edge.horizontal) {
    return { x1: a.x + layout.radius, y1: a.y, x2: b.x - layout.radius, y2: b.y };
  }
  return { x1: a.x, y1: a.y + layout.radius, x2: b.x, y2: b.y - layout.radius };
}

// The one or two rectangles that draw a bridge. A single bridge runs down the
// middle of the lane; a double one is two lines either side of it, which is how
// a player counts them at a glance without reading a number.
export function bridgeRects(layout, puzzle, edgeId, count) {
  if (count <= 0) {
    return [];
  }
  const edge = puzzle.edges[edgeId];
  const line = edgeLine(layout, puzzle, edgeId);
  const thickness = layout.bridge;
  const offsets = count === 1 ? [0] : [-layout.bridgeGap, layout.bridgeGap];

  return offsets.map((offset) => {
    if (edge.horizontal) {
      return {
        x: Math.min(line.x1, line.x2),
        y: Math.round(line.y1 + offset - thickness / 2),
        w: Math.max(1, Math.abs(line.x2 - line.x1)),
        h: thickness,
      };
    }
    return {
      x: Math.round(line.x1 + offset - thickness / 2),
      y: Math.min(line.y1, line.y2),
      w: thickness,
      h: Math.max(1, Math.abs(line.y2 - line.y1)),
    };
  });
}

// The island under a world-space point, or null. The nearest one wins, so two
// overlapping tap areas resolve to whichever the player was closer to.
export function islandAt(puzzle, layout, x, y) {
  const reach = layout.radius + layout.tapSlack;
  let best = null;
  let bestDistance = reach * reach;

  for (let id = 0; id < puzzle.islands.length; id++) {
    const centre = islandCenter(layout, puzzle.islands[id]);
    const dx = x - centre.x;
    const dy = y - centre.y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

// The bridge lane under a world-space point, or null. Only the stretch between
// the two islands counts, so a tap beyond the end of a lane is not caught by a
// bridge that merely lines up with it.
export function edgeAt(puzzle, layout, x, y) {
  const reach = layout.bridgeTap;
  let best = null;
  let bestDistance = reach + 1;

  for (let id = 0; id < puzzle.edges.length; id++) {
    const edge = puzzle.edges[id];
    const line = edgeLine(layout, puzzle, id);
    const along = edge.horizontal ? x : y;
    const across = edge.horizontal ? Math.abs(y - line.y1) : Math.abs(x - line.x1);
    const low = edge.horizontal ? Math.min(line.x1, line.x2) : Math.min(line.y1, line.y2);
    const high = edge.horizontal ? Math.max(line.x1, line.x2) : Math.max(line.y1, line.y2);

    if (along < low || along > high || across > reach) {
      continue;
    }
    if (across < bestDistance) {
      best = id;
      bestDistance = across;
    }
  }
  return best;
}

// What a tap at this world point means. Islands win over bridges: an island is
// the smaller target and the one the player aimed at, and every bridge ends at
// one.
export function hitTest(puzzle, layout, x, y) {
  const island = islandAt(puzzle, layout, x, y);
  if (island !== null) {
    return { type: "island", id: island };
  }
  const edge = edgeAt(puzzle, layout, x, y);
  if (edge !== null) {
    return { type: "edge", id: edge };
  }
  return null;
}
