import { describe, it, expect } from "vitest";
import {
  boxContains,
  findZone,
  hudLayout,
  menuMetrics,
  pausedRows,
  solvedRows,
  stackLayout,
  startRows,
} from "../lib/hud.js";
import { ROUND_SIZES } from "./fixtures.mjs";

// A stacked menu that is taller than the screen would be cut off at both ends.
// The check lives here rather than in lib/ because nothing the app runs needs to
// ask - it is a guarantee about the metrics, and this is where guarantees are
// kept honest.
function stackFits(screenSize, items) {
  return items.reduce((total, item) => total + item.height, 0) <= screenSize;
}

function cornersInside(size, box) {
  const radius = size / 2;
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
  return corners.every(([x, y]) => {
    const dx = x - radius;
    const dy = y - radius;
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  });
}

describe("menuMetrics", () => {
  it("scales with the screen", () => {
    const small = menuMetrics(466);
    const large = menuMetrics(480);
    expect(large.big).toBeGreaterThanOrEqual(small.big);
    expect(large.button).toBeGreaterThanOrEqual(small.button);
  });

  it("puts the sizes in a sensible order", () => {
    for (const size of ROUND_SIZES) {
      const metrics = menuMetrics(size);
      expect(metrics.big).toBeGreaterThan(metrics.row);
      expect(metrics.row).toBeGreaterThan(metrics.small);
      expect(metrics.button).toBeGreaterThan(metrics.small);
      expect(metrics.gap).toBeLessThan(metrics.small);
    }
  });

  it("keeps a button big enough to hit with a finger", () => {
    for (const size of ROUND_SIZES) {
      expect(menuMetrics(size).button).toBeGreaterThanOrEqual(44);
    }
  });
});

describe("boxContains", () => {
  const box = { x: 10, y: 20, w: 100, h: 50 };

  it("sees a point inside", () => {
    expect(boxContains(box, 50, 40)).toBe(true);
  });

  it("counts the edges as inside", () => {
    expect(boxContains(box, 10, 20)).toBe(true);
    expect(boxContains(box, 110, 70)).toBe(true);
  });

  it("sees a point outside", () => {
    expect(boxContains(box, 9, 40)).toBe(false);
    expect(boxContains(box, 50, 71)).toBe(false);
  });
});

describe("findZone", () => {
  const lower = { role: "under", box: { x: 0, y: 0, w: 100, h: 100 } };
  const upper = { role: "over", box: { x: 40, y: 40, w: 100, h: 100 } };

  it("finds the zone under a point", () => {
    expect(findZone([lower, upper], 10, 10)).toBe(lower);
    expect(findZone([lower, upper], 130, 130)).toBe(upper);
  });

  it("gives an overlap to whichever was added last", () => {
    // Zones are added in drawing order, so the last one is the one on top.
    expect(findZone([lower, upper], 50, 50)).toBe(upper);
  });

  it("finds nothing where there is nothing", () => {
    expect(findZone([lower, upper], 300, 300)).toBe(null);
    expect(findZone([], 10, 10)).toBe(null);
  });
});

describe("stackLayout", () => {
  it("centres the stack on the screen", () => {
    const metrics = menuMetrics(480);
    const rows = [
      { kind: "text", role: "a", height: 40 },
      { kind: "button", role: "b", height: 60 },
    ];
    const stack = stackLayout(480, rows, metrics);
    expect(stack.height).toBe(100);
    expect(stack.top).toBe(190);
    expect(stack.rows[0].box.y).toBe(190);
    expect(stack.rows[1].box.y).toBe(230);
  });

  it("takes up space for a gap without drawing one", () => {
    const metrics = menuMetrics(480);
    const stack = stackLayout(
      480,
      [
        { kind: "text", role: "a", height: 40 },
        { kind: "gap", height: 20 },
        { kind: "text", role: "b", height: 40 },
      ],
      metrics
    );
    expect(stack.rows.length).toBe(2);
    expect(stack.rows[1].box.y - stack.rows[0].box.y).toBe(60);
  });

  it("keeps the role on every row so the page knows what to put in it", () => {
    const stack = stackLayout(480, startRows(menuMetrics(480), true), menuMetrics(480));
    expect(stack.rows.map((row) => row.role)).toContain("play");
    expect(stack.rows.map((row) => row.role)).toContain("hint_drag");
  });

  it("gives the best time and the boards solved a line each", () => {
    // Run together they overrun the row in the longer languages.
    const roles = startRows(menuMetrics(480), true).map((row) => row.role);
    expect(roles).toContain("best");
    expect(roles).toContain("solved");
  });

  it("keeps every row inside the round screen", () => {
    for (const size of ROUND_SIZES) {
      const metrics = menuMetrics(size);
      for (const rows of [startRows(metrics, true), pausedRows(metrics), solvedRows(metrics)]) {
        for (const row of stackLayout(size, rows, metrics).rows) {
          expect(cornersInside(size, row.box), `${row.role} on ${size}`).toBe(true);
          expect(row.box.w, `${row.role} on ${size}`).toBeGreaterThan(size * 0.4);
        }
      }
    }
  });

  it("puts a backdrop behind every row of the stack", () => {
    for (const size of ROUND_SIZES) {
      const metrics = menuMetrics(size);
      for (const rows of [startRows(metrics, true), pausedRows(metrics), solvedRows(metrics)]) {
        const stack = stackLayout(size, rows, metrics);
        expect(stack.backdrop.y).toBeLessThanOrEqual(stack.top);
        expect(stack.backdrop.y + stack.backdrop.h).toBeGreaterThanOrEqual(
          stack.top + stack.height
        );
        // Nothing may hang over the edge of its own background.
        for (const row of stack.rows) {
          expect(row.box.x).toBeGreaterThanOrEqual(stack.backdrop.x);
          expect(row.box.x + row.box.w).toBeLessThanOrEqual(stack.backdrop.x + stack.backdrop.w);
        }
      }
    }
  });

  it("keeps the backdrop on the screen", () => {
    for (const size of ROUND_SIZES) {
      const metrics = menuMetrics(size);
      const stack = stackLayout(size, startRows(metrics, true), metrics);
      expect(stack.backdrop.y).toBeGreaterThanOrEqual(0);
      expect(stack.backdrop.y + stack.backdrop.h).toBeLessThanOrEqual(size);
    }
  });
});

describe("the screens", () => {
  it("all fit on both round watches", () => {
    for (const size of ROUND_SIZES) {
      const metrics = menuMetrics(size);
      expect(stackFits(size, startRows(metrics, true)), `start on ${size}`).toBe(true);
      expect(stackFits(size, pausedRows(metrics)), `paused on ${size}`).toBe(true);
      expect(stackFits(size, solvedRows(metrics)), `solved on ${size}`).toBe(true);
    }
  });

  it("drop the drag hint for a board that fits the screen whole", () => {
    const metrics = menuMetrics(480);
    const withHint = startRows(metrics, true).map((row) => row.role);
    const withoutHint = startRows(metrics, false).map((row) => row.role);
    expect(withHint).toContain("hint_drag");
    expect(withoutHint).not.toContain("hint_drag");
    expect(withoutHint).toContain("hint_tap");
  });

  it("offer a way out of every screen that covers the board", () => {
    const metrics = menuMetrics(480);
    expect(pausedRows(metrics).map((row) => row.role)).toEqual(
      expect.arrayContaining(["resume", "restart", "quit"])
    );
    expect(solvedRows(metrics).map((row) => row.role)).toEqual(
      expect.arrayContaining(["again", "quit"])
    );
  });

  it("let the difficulty and the board source be changed, and a board be started", () => {
    const roles = startRows(menuMetrics(480), true)
      .filter((row) => row.kind === "button")
      .map((row) => row.role);
    expect(roles).toEqual(["level", "source", "play"]);
  });
});

describe("hudLayout", () => {
  it("keeps the progress readout and the action bar inside the screen", () => {
    for (const size of ROUND_SIZES) {
      const hud = hudLayout(size);
      expect(cornersInside(size, hud.progress), `progress on ${size}`).toBe(true);
      expect(cornersInside(size, hud.undo), `undo on ${size}`).toBe(true);
      expect(cornersInside(size, hud.menu), `menu on ${size}`).toBe(true);
    }
  });

  it("keeps the two action buttons apart", () => {
    for (const size of ROUND_SIZES) {
      const hud = hudLayout(size);
      expect(hud.undo.x + hud.undo.w).toBeLessThan(hud.menu.x);
      expect(hud.undo.w).toBe(hud.menu.w);
      expect(hud.undo.y).toBe(hud.menu.y);
    }
  });

  it("keeps the buttons wide enough for a word and tall enough for a finger", () => {
    for (const size of ROUND_SIZES) {
      const hud = hudLayout(size);
      expect(hud.undo.w).toBeGreaterThan(size * 0.2);
      expect(hud.undo.h).toBeGreaterThanOrEqual(44);
    }
  });

  it("leaves the middle of the screen to the board", () => {
    for (const size of ROUND_SIZES) {
      const hud = hudLayout(size);
      expect(hud.progress.y + hud.progress.h).toBeLessThan(size * 0.3);
      expect(hud.undo.y).toBeGreaterThan(size * 0.7);
    }
  });

  it("does not let the readout overlap the action bar", () => {
    for (const size of ROUND_SIZES) {
      const hud = hudLayout(size);
      expect(hud.progress.y + hud.progress.h).toBeLessThan(hud.undo.y);
    }
  });
});
