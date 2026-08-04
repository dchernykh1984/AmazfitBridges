import { describe, it, expect } from "vitest";
import { createLayout, cellCenter } from "../lib/board-geometry.js";
import {
  axisBounds,
  boxToScreen,
  centerCamera,
  clampAxis,
  clampCamera,
  discIsOnScreen,
  needsPanning,
  overscrollFor,
  panBy,
  toScreen,
  toWorld,
} from "../lib/camera.js";
import { LEVELS } from "../lib/levels.js";
import { ROUND_SIZES } from "./fixtures.mjs";

// Put a world point as near the middle of the screen as the limits allow. The
// app never needs this - it only ever centres a whole board - but it is how the
// tests ask "could the player get to this cell?".
function centerOn(worldX, worldY, layout, viewSize) {
  return clampCamera({ x: worldX - viewSize / 2, y: worldY - viewSize / 2 }, layout, viewSize);
}

// Whether every cell of a board can be brought fully into view by dragging. The
// generator may put an island in any cell, so a board that fails this has a cell
// the player could never properly see.
function everyCellReachable(layout, viewSize) {
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const centre = cellCenter(layout, col, row);
      const screen = toScreen(centerOn(centre.x, centre.y, layout, viewSize), centre.x, centre.y);
      if (!discIsOnScreen(viewSize, screen.x, screen.y, layout.radius)) {
        return false;
      }
    }
  }
  return true;
}

const VIEW = 480;

describe("axisBounds", () => {
  it("lets a big board be dragged from one end to the other", () => {
    const bounds = axisBounds(1000, 480, 50);
    expect(bounds.min).toBe(-50);
    expect(bounds.max).toBe(1000 - 480 + 50);
  });

  it("centres a board smaller than the screen and gives it the same slack", () => {
    const bounds = axisBounds(200, 480, 50);
    const centre = (200 - 480) / 2;
    expect(bounds.min).toBe(centre - 50);
    expect(bounds.max).toBe(centre + 50);
  });

  it("pins the board exactly when there is no slack to give", () => {
    const bounds = axisBounds(200, 480, 0);
    expect(bounds.min).toBe(bounds.max);
    expect(bounds.min).toBe((200 - 480) / 2);
  });
});

describe("clampAxis", () => {
  it("leaves a position that is already in range alone", () => {
    expect(clampAxis(100, 1000, 480, 50)).toBe(100);
  });

  it("pulls a position past either end back to the limit", () => {
    expect(clampAxis(-9999, 1000, 480, 50)).toBe(-50);
    expect(clampAxis(9999, 1000, 480, 50)).toBe(1000 - 480 + 50);
  });

  it("recovers from a position that is not a number", () => {
    expect(clampAxis(NaN, 1000, 480, 50)).toBe(-50);
  });
});

describe("centerCamera", () => {
  it("puts the middle of the board in the middle of the screen", () => {
    const layout = createLayout(VIEW, 13, 13);
    const camera = centerCamera(layout, VIEW);
    expect(camera.x + VIEW / 2).toBeCloseTo(layout.width / 2, 0);
    expect(camera.y + VIEW / 2).toBeCloseTo(layout.height / 2, 0);
  });

  it("is already within the limits on every board", () => {
    for (const size of ROUND_SIZES) {
      for (const level of LEVELS) {
        const layout = createLayout(size, level.cols, level.rows);
        const camera = centerCamera(layout, size);
        expect(clampCamera(camera, layout, size)).toEqual(camera);
      }
    }
  });
});

describe("panBy", () => {
  it("moves the map the way the finger went", () => {
    const layout = createLayout(VIEW, 13, 13);
    const start = centerCamera(layout, VIEW);
    // Dragging right shows more of the left of the board, so the camera moves left.
    const panned = panBy(start, 40, 0, layout, VIEW);
    expect(panned.x).toBe(start.x - 40);
    expect(panned.y).toBe(start.y);
  });

  it("stops at the limit however hard the map is thrown", () => {
    const layout = createLayout(VIEW, 13, 13);
    let camera = centerCamera(layout, VIEW);
    for (let i = 0; i < 200; i++) {
      camera = panBy(camera, 100, 100, layout, VIEW);
    }
    const bounds = axisBounds(layout.width, VIEW, overscrollFor(VIEW));
    expect(camera.x).toBe(bounds.min);
    expect(camera.y).toBe(bounds.min);
  });

  it("comes back to where it started when the drag is reversed", () => {
    const layout = createLayout(VIEW, 13, 13);
    const start = centerCamera(layout, VIEW);
    const there = panBy(start, 60, -30, layout, VIEW);
    expect(panBy(there, -60, 30, layout, VIEW)).toEqual(start);
  });

  it("can only nudge a board that already fits the screen", () => {
    // Small boards still move, so a corner can be pulled out of the bezel - but
    // only by the overscroll, never far enough to slide the board off entirely.
    const layout = createLayout(VIEW, 3, 3);
    const start = centerCamera(layout, VIEW);
    const far = panBy(start, 9999, 9999, layout, VIEW);
    expect(Math.abs(far.x - start.x)).toBe(overscrollFor(VIEW));
    expect(Math.abs(far.y - start.y)).toBe(overscrollFor(VIEW));
  });
});

describe("reaching the whole board", () => {
  it("can bring every cell of every board fully into view", () => {
    for (const size of ROUND_SIZES) {
      for (const level of LEVELS) {
        const layout = createLayout(size, level.cols, level.rows);
        expect(everyCellReachable(layout, size), `${level.id} on ${size}`).toBe(true);
      }
    }
  });

  it("centres exactly when the board is big enough to allow it", () => {
    const layout = createLayout(VIEW, 13, 13);
    const centre = cellCenter(layout, 6, 6);
    const camera = centerOn(centre.x, centre.y, layout, VIEW);
    expect(toScreen(camera, centre.x, centre.y)).toEqual({ x: VIEW / 2, y: VIEW / 2 });
  });

  it("gets a corner island as close to the middle as the limits allow", () => {
    const layout = createLayout(VIEW, 13, 13);
    const centre = cellCenter(layout, 0, 0);
    const camera = centerOn(centre.x, centre.y, layout, VIEW);
    const screen = toScreen(camera, centre.x, centre.y);
    const distance = Math.hypot(screen.x - VIEW / 2, screen.y - VIEW / 2);
    expect(distance + layout.radius).toBeLessThanOrEqual(VIEW / 2);
  });
});

describe("boxToScreen", () => {
  it("shifts a whole box by the camera without resizing it", () => {
    const box = { x: 300, y: 400, w: 90, h: 12 };
    expect(boxToScreen({ x: 100, y: 50 }, box)).toEqual({ x: 200, y: 350, w: 90, h: 12 });
  });

  it("agrees with toScreen about where the corner lands", () => {
    const camera = { x: -37, y: 214 };
    const box = { x: 300, y: 400, w: 90, h: 12 };
    const corner = toScreen(camera, box.x, box.y);
    const moved = boxToScreen(camera, box);
    expect({ x: moved.x, y: moved.y }).toEqual(corner);
  });
});

describe("toScreen and toWorld", () => {
  it("are inverses of each other", () => {
    const camera = { x: 123, y: -45 };
    const screen = toScreen(camera, 300, 400);
    expect(toWorld(camera, screen.x, screen.y)).toEqual({ x: 300, y: 400 });
  });

  it("shifts by the camera", () => {
    expect(toScreen({ x: 100, y: 50 }, 150, 80)).toEqual({ x: 50, y: 30 });
    expect(toWorld({ x: 100, y: 50 }, 50, 30)).toEqual({ x: 150, y: 80 });
  });
});

describe("needsPanning", () => {
  it("says no for a board that is entirely visible at a glance", () => {
    expect(needsPanning(createLayout(VIEW, 3, 3), VIEW)).toBe(false);
  });

  it("says yes for every board the game actually deals", () => {
    // Even the smallest one is a square on a round screen, so its corners start
    // out under the bezel and the drag hint is worth showing.
    for (const size of ROUND_SIZES) {
      for (const level of LEVELS) {
        const layout = createLayout(size, level.cols, level.rows);
        expect(needsPanning(layout, size), `${level.id} on ${size}`).toBe(true);
      }
    }
  });

  it("agrees with whether a corner island is really off screen to begin with", () => {
    for (const size of ROUND_SIZES) {
      for (const cols of [2, 3, 4, 5, 6, 7, 9, 11, 13]) {
        const layout = createLayout(size, cols, cols);
        const camera = centerCamera(layout, size);
        const corner = cellCenter(layout, cols - 1, cols - 1);
        const screen = toScreen(camera, corner.x, corner.y);
        const distance = Math.hypot(screen.x - size / 2, screen.y - size / 2);
        expect(needsPanning(layout, size), `${cols} cols on ${size}`).toBe(
          distance + layout.radius > size / 2
        );
      }
    }
  });
});
