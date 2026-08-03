import { describe, it, expect } from "vitest";
import {
  bridgeRects,
  cellCenter,
  createLayout,
  edgeAt,
  edgeLine,
  hitTest,
  islandAt,
  islandCenter,
} from "../lib/board-geometry.js";
import { emptyState, withBridge } from "../lib/puzzle.js";
import { crossingPuzzle, edgeAtCells, linePuzzle, ringPuzzle, ROUND_SIZES } from "./fixtures.mjs";

describe("createLayout", () => {
  it("sizes everything off the screen diameter", () => {
    for (const size of ROUND_SIZES) {
      const layout = createLayout(size, 9, 9);
      expect(layout.cell).toBeGreaterThan(size * 0.1);
      expect(layout.cell).toBeLessThan(size * 0.15);
      expect(layout.width).toBe(layout.cell * 9);
      expect(layout.height).toBe(layout.cell * 9);
    }
  });

  it("leaves a gap between neighbouring islands to draw a bridge in", () => {
    for (const size of ROUND_SIZES) {
      const layout = createLayout(size, 9, 9);
      // Two islands are never closer than two cells, so the shortest possible
      // lane is two cells long minus the two discs.
      expect(2 * layout.cell - 2 * layout.radius).toBeGreaterThan(layout.cell / 2);
    }
  });

  it("keeps a number small enough to sit inside its island", () => {
    for (const size of ROUND_SIZES) {
      const layout = createLayout(size, 9, 9);
      expect(layout.numberSize).toBeLessThan(layout.radius * 2);
      expect(layout.numberSize).toBeGreaterThan(12);
    }
  });

  it("keeps a double bridge's two lines apart and inside the lane", () => {
    for (const size of ROUND_SIZES) {
      const layout = createLayout(size, 9, 9);
      expect(layout.bridgeGap * 2).toBeGreaterThan(layout.bridge);
      expect(layout.bridgeGap + layout.bridge / 2).toBeLessThan(layout.radius);
    }
  });

  it("survives a silly board size", () => {
    const layout = createLayout(480, 0, -3);
    expect(layout.cols).toBe(1);
    expect(layout.rows).toBe(1);
    expect(layout.cell).toBeGreaterThan(0);
  });
});

describe("island positions", () => {
  it("puts an island in the middle of its cell", () => {
    const layout = createLayout(480, 7, 7);
    expect(cellCenter(layout, 0, 0)).toEqual({
      x: Math.round(layout.cell / 2),
      y: Math.round(layout.cell / 2),
    });
  });

  it("spaces islands one cell apart", () => {
    const layout = createLayout(480, 7, 7);
    const first = cellCenter(layout, 2, 3);
    const second = cellCenter(layout, 3, 3);
    expect(second.x - first.x).toBe(layout.cell);
    expect(second.y).toBe(first.y);
  });

  it("keeps every island inside the world it belongs to", () => {
    const layout = createLayout(480, 11, 11);
    for (let row = 0; row < 11; row++) {
      for (let col = 0; col < 11; col++) {
        const centre = cellCenter(layout, col, row);
        expect(centre.x - layout.radius).toBeGreaterThanOrEqual(0);
        expect(centre.y - layout.radius).toBeGreaterThanOrEqual(0);
        expect(centre.x + layout.radius).toBeLessThanOrEqual(layout.width);
        expect(centre.y + layout.radius).toBeLessThanOrEqual(layout.height);
      }
    }
  });
});

describe("edgeLine", () => {
  it("runs from the edge of one island to the edge of the other", () => {
    const puzzle = linePuzzle();
    const layout = createLayout(480, 5, 1);
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    const line = edgeLine(layout, puzzle, edge);
    const a = islandCenter(layout, puzzle.islands[0]);
    const b = islandCenter(layout, puzzle.islands[1]);

    expect(line.y1).toBe(a.y);
    expect(line.y2).toBe(b.y);
    expect(line.x1).toBe(a.x + layout.radius);
    expect(line.x2).toBe(b.x - layout.radius);
    expect(line.x1).toBeLessThan(line.x2);
  });

  it("does the same going down a column", () => {
    const puzzle = ringPuzzle();
    const layout = createLayout(480, 5, 3);
    const edge = edgeAtCells(puzzle, [0, 0], [0, 2]);
    const line = edgeLine(layout, puzzle, edge);
    expect(line.x1).toBe(line.x2);
    expect(line.y1).toBeLessThan(line.y2);
  });
});

describe("bridgeRects", () => {
  const puzzle = ringPuzzle();
  const layout = createLayout(480, 5, 3);
  const across = edgeAtCells(puzzle, [0, 0], [2, 0]);
  const down = edgeAtCells(puzzle, [0, 0], [0, 2]);

  it("draws nothing where there is no bridge", () => {
    expect(bridgeRects(layout, puzzle, across, 0)).toEqual([]);
    expect(bridgeRects(layout, puzzle, across, -1)).toEqual([]);
  });

  it("draws one line down the middle of the lane for a single bridge", () => {
    const rects = bridgeRects(layout, puzzle, across, 1);
    expect(rects.length).toBe(1);
    const line = edgeLine(layout, puzzle, across);
    expect(rects[0].h).toBe(layout.bridge);
    expect(rects[0].y + rects[0].h / 2).toBeCloseTo(line.y1, 0);
  });

  it("draws two lines either side of the middle for a double bridge", () => {
    const rects = bridgeRects(layout, puzzle, across, 2);
    expect(rects.length).toBe(2);
    const line = edgeLine(layout, puzzle, across);
    const offsets = rects.map((rect) => rect.y + rect.h / 2 - line.y1);
    expect(offsets[0]).toBeCloseTo(-layout.bridgeGap, 0);
    expect(offsets[1]).toBeCloseTo(layout.bridgeGap, 0);
  });

  it("turns the rectangle on its side for a vertical lane", () => {
    const rects = bridgeRects(layout, puzzle, down, 2);
    expect(rects.length).toBe(2);
    for (const rect of rects) {
      expect(rect.w).toBe(layout.bridge);
      expect(rect.h).toBeGreaterThan(rect.w);
    }
    expect(rects[0].x).toBeLessThan(rects[1].x);
  });

  it("never draws a bridge over an island", () => {
    const rects = bridgeRects(layout, puzzle, across, 1);
    const a = islandCenter(layout, puzzle.islands[puzzle.edges[across].a]);
    expect(rects[0].x).toBeGreaterThanOrEqual(a.x + layout.radius);
  });
});

describe("islandAt", () => {
  const puzzle = ringPuzzle();
  const layout = createLayout(480, 5, 3);

  it("finds the island a tap landed on", () => {
    for (let id = 0; id < puzzle.islands.length; id++) {
      const centre = islandCenter(layout, puzzle.islands[id]);
      expect(islandAt(puzzle, layout, centre.x, centre.y)).toBe(id);
    }
  });

  it("forgives a tap that lands just off the disc", () => {
    const centre = islandCenter(layout, puzzle.islands[0]);
    expect(islandAt(puzzle, layout, centre.x + layout.radius + 2, centre.y)).toBe(0);
  });

  it("finds nothing out in open water", () => {
    const centre = islandCenter(layout, puzzle.islands[0]);
    expect(islandAt(puzzle, layout, centre.x, centre.y + layout.cell)).toBe(null);
  });

  it("picks the nearer island when two tap areas overlap", () => {
    const first = islandCenter(layout, puzzle.islands[0]);
    const second = islandCenter(layout, puzzle.islands[1]);
    const nearFirst = Math.round(first.x + (second.x - first.x) * 0.1);
    expect(islandAt(puzzle, layout, nearFirst, first.y)).toBe(0);
  });
});

describe("edgeAt", () => {
  const puzzle = ringPuzzle();
  const layout = createLayout(480, 5, 3);

  it("finds the lane a tap landed on", () => {
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    const line = edgeLine(layout, puzzle, edge);
    expect(edgeAt(puzzle, layout, (line.x1 + line.x2) / 2, line.y1)).toBe(edge);
  });

  it("does not catch a tap past the end of the row", () => {
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    const line = edgeLine(layout, puzzle, edge);
    const lastIsland = islandCenter(layout, puzzle.islands[2]);
    expect(edgeAt(puzzle, layout, lastIsland.x + layout.cell, line.y1)).toBe(null);
  });

  it("hands a tap between two lanes to the one it is actually on", () => {
    const first = edgeAtCells(puzzle, [0, 0], [2, 0]);
    const second = edgeAtCells(puzzle, [2, 0], [4, 0]);
    const line = edgeLine(layout, puzzle, second);
    expect(edgeAt(puzzle, layout, (line.x1 + line.x2) / 2, line.y1)).toBe(second);
    expect(edgeAt(puzzle, layout, (line.x1 + line.x2) / 2, line.y1)).not.toBe(first);
  });

  it("does not catch a tap well off to the side of the lane", () => {
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    const line = edgeLine(layout, puzzle, edge);
    const middle = (line.x1 + line.x2) / 2;
    expect(edgeAt(puzzle, layout, middle, line.y1 + layout.cell)).toBe(null);
  });

  it("picks the nearer lane where two lanes cross", () => {
    const crossing = crossingPuzzle();
    const grid = createLayout(480, 3, 3);
    const across = edgeAtCells(crossing, [0, 1], [2, 1]);
    const down = edgeAtCells(crossing, [1, 0], [1, 2]);
    const acrossLine = edgeLine(grid, crossing, across);
    const downLine = edgeLine(grid, crossing, down);
    // Well above the crossing point the vertical lane is the only one near.
    expect(edgeAt(crossing, grid, downLine.x1, acrossLine.y1 - grid.cell / 2)).toBe(down);
    // Well to the side of it, the horizontal one is.
    expect(edgeAt(crossing, grid, downLine.x1 - grid.cell / 2, acrossLine.y1)).toBe(across);
  });
});

describe("hitTest", () => {
  const puzzle = ringPuzzle();
  const layout = createLayout(480, 5, 3);

  it("reports an island by id", () => {
    const centre = islandCenter(layout, puzzle.islands[2]);
    expect(hitTest(puzzle, layout, centre.x, centre.y)).toEqual({ type: "island", id: 2 });
  });

  it("reports a lane when the tap missed every island", () => {
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    const line = edgeLine(layout, puzzle, edge);
    expect(hitTest(puzzle, layout, (line.x1 + line.x2) / 2, line.y1)).toEqual({
      type: "edge",
      id: edge,
    });
  });

  it("prefers the island when a tap could be either", () => {
    const centre = islandCenter(layout, puzzle.islands[0]);
    const hit = hitTest(puzzle, layout, centre.x + layout.radius + 1, centre.y);
    expect(hit.type).toBe("island");
  });

  it("reports nothing for a tap in open water", () => {
    expect(hitTest(puzzle, layout, layout.width - 1, layout.height - 1)).toBe(null);
  });

  it("works the same whether or not a bridge is actually there", () => {
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    const line = edgeLine(layout, puzzle, edge);
    const state = withBridge(puzzle, emptyState(puzzle), edge, 1);
    expect(state[edge]).toBe(1);
    expect(hitTest(puzzle, layout, (line.x1 + line.x2) / 2, line.y1).id).toBe(edge);
  });
});
