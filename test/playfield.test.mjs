import { describe, it, expect } from "vitest";
import {
  CELL_MARGIN,
  islandCapacity,
  isPlayable,
  playableCells,
  playfieldRadius,
} from "../lib/playfield.js";
import { createLayout } from "../lib/board-geometry.js";
import { centerCamera, overscrollFor, axisBounds } from "../lib/camera.js";
import { LEVELS } from "../lib/levels.js";
import { ROUND_SIZES } from "./fixtures.mjs";

describe("playfieldRadius", () => {
  it("is the grid's inscribed circle, pulled in by half a cell", () => {
    expect(playfieldRadius(7, 7)).toBe(3.5 - CELL_MARGIN);
    expect(playfieldRadius(13, 13)).toBe(6.5 - CELL_MARGIN);
  });

  it("takes the smaller side of an oblong grid", () => {
    expect(playfieldRadius(13, 7)).toBe(playfieldRadius(7, 7));
  });
});

describe("isPlayable", () => {
  it("keeps the middle of the grid", () => {
    expect(isPlayable(7, 7, 3, 3)).toBe(true);
  });

  it("drops all four corners", () => {
    for (const [col, row] of [
      [0, 0],
      [6, 0],
      [0, 6],
      [6, 6],
    ]) {
      expect(isPlayable(7, 7, col, row), `${col},${row}`).toBe(false);
    }
  });

  it("keeps the middle of each edge, which is where the circle reaches", () => {
    expect(isPlayable(7, 7, 3, 0)).toBe(true);
    expect(isPlayable(7, 7, 0, 3)).toBe(true);
  });

  it("refuses a cell that is not on the grid at all", () => {
    expect(isPlayable(7, 7, -1, 3)).toBe(false);
    expect(isPlayable(7, 7, 7, 3)).toBe(false);
    expect(isPlayable(7, 7, 3, -1)).toBe(false);
  });

  it("is symmetric about both axes", () => {
    for (const level of LEVELS) {
      for (let row = 0; row < level.rows; row++) {
        for (let col = 0; col < level.cols; col++) {
          const here = isPlayable(level.cols, level.rows, col, row);
          expect(isPlayable(level.cols, level.rows, level.cols - 1 - col, row), "mirrored x").toBe(
            here
          );
          expect(isPlayable(level.cols, level.rows, col, level.rows - 1 - row), "mirrored y").toBe(
            here
          );
        }
      }
    }
  });
});

describe("playableCells", () => {
  it("lists exactly the cells isPlayable accepts", () => {
    const listed = new Set(playableCells(9, 9).map((cell) => cell.col + ":" + cell.row));
    let expected = 0;
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (isPlayable(9, 9, col, row)) {
          expected += 1;
          expect(listed.has(col + ":" + row), `${col},${row}`).toBe(true);
        }
      }
    }
    expect(listed.size).toBe(expected);
  });

  it("throws away the corners but keeps most of the grid", () => {
    for (const level of LEVELS) {
      const cells = playableCells(level.cols, level.rows);
      const total = level.cols * level.rows;
      expect(cells.length, level.id).toBeLessThan(total);
      expect(cells.length, level.id).toBeGreaterThan(total * 0.55);
    }
  });

  it("is in reading order", () => {
    const cells = playableCells(9, 9);
    for (let i = 1; i < cells.length; i++) {
      const before = cells[i - 1];
      const now = cells[i];
      expect(before.row < now.row || (before.row === now.row && before.col < now.col)).toBe(true);
    }
  });
});

describe("islandCapacity", () => {
  it("leaves every difficulty room for the islands it asks for", () => {
    // Islands may never sit in touching cells, so the ceiling is one of every
    // two cells on a chequerboard. A difficulty that asked for more than that
    // could never be generated at all.
    for (const level of LEVELS) {
      expect(islandCapacity(level.cols, level.rows), level.id).toBeGreaterThan(level.islands);
    }
  });

  it("leaves enough slack that the generator is not painted into a corner", () => {
    for (const level of LEVELS) {
      expect(islandCapacity(level.cols, level.rows), level.id).toBeGreaterThanOrEqual(
        level.islands * 1.5
      );
    }
  });
});

describe("the round playfield against the round screen", () => {
  it("keeps the smallest board entirely on screen without any dragging", () => {
    // This is the bug that started it: at rest, the corner island of the
    // smallest board was sliced in half by the bezel.
    for (const size of ROUND_SIZES) {
      const level = LEVELS[0];
      const layout = createLayout(size, level.cols, level.rows);
      const camera = centerCamera(layout, size);
      for (const cell of playableCells(level.cols, level.rows)) {
        const x = (cell.col + 0.5) * layout.cell - camera.x;
        const y = (cell.row + 0.5) * layout.cell - camera.y;
        const distance = Math.hypot(x - size / 2, y - size / 2);
        expect(distance + layout.radius, `${cell.col},${cell.row} on ${size}`).toBeLessThanOrEqual(
          size / 2
        );
      }
    }
  });

  it("can bring every usable cell of every board fully into view", () => {
    for (const size of ROUND_SIZES) {
      for (const level of LEVELS) {
        const layout = createLayout(size, level.cols, level.rows);
        const overscroll = overscrollFor(size);
        const horizontal = axisBounds(layout.width, size, overscroll);
        const vertical = axisBounds(layout.height, size, overscroll);

        for (const cell of playableCells(level.cols, level.rows)) {
          const worldX = (cell.col + 0.5) * layout.cell;
          const worldY = (cell.row + 0.5) * layout.cell;
          const cameraX = Math.min(horizontal.max, Math.max(horizontal.min, worldX - size / 2));
          const cameraY = Math.min(vertical.max, Math.max(vertical.min, worldY - size / 2));
          const distance = Math.hypot(worldX - cameraX - size / 2, worldY - cameraY - size / 2);
          expect(
            distance + layout.radius,
            `${level.id} ${cell.col},${cell.row} on ${size}`
          ).toBeLessThanOrEqual(size / 2);
        }
      }
    }
  });

  it("cuts the worst overflow at rest by more than half on every board", () => {
    // The corners were the whole problem; dropping them is what fixes it.
    for (const size of ROUND_SIZES) {
      for (const level of LEVELS) {
        const layout = createLayout(size, level.cols, level.rows);
        const camera = centerCamera(layout, size);
        const reach = (col, row) => {
          const x = (col + 0.5) * layout.cell - camera.x;
          const y = (row + 0.5) * layout.cell - camera.y;
          return Math.hypot(x - size / 2, y - size / 2) + layout.radius - size / 2;
        };
        const corner = reach(level.cols - 1, level.rows - 1);
        let worst = -Infinity;
        for (const cell of playableCells(level.cols, level.rows)) {
          worst = Math.max(worst, reach(cell.col, cell.row));
        }
        expect(worst, `${level.id} on ${size}`).toBeLessThan(Math.max(1, corner / 2));
      }
    }
  });
});
