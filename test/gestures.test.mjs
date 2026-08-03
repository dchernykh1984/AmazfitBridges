import { describe, it, expect } from "vitest";
import {
  cancel,
  createTracker,
  DEFAULT_SLOP,
  DEFAULT_TAP_MS,
  pointerDown,
  pointerMove,
  pointerUp,
} from "../lib/gestures.js";

describe("createTracker", () => {
  it("starts idle with the default thresholds", () => {
    const tracker = createTracker();
    expect(tracker.active).toBe(false);
    expect(tracker.dragging).toBe(false);
    expect(tracker.slop).toBe(DEFAULT_SLOP);
    expect(tracker.tapMs).toBe(DEFAULT_TAP_MS);
  });

  it("takes thresholds of its own", () => {
    const tracker = createTracker({ slop: 3, tapMs: 100 });
    expect(tracker.slop).toBe(3);
    expect(tracker.tapMs).toBe(100);
  });

  it("ignores thresholds that are not numbers", () => {
    const tracker = createTracker({ slop: "wide", tapMs: null });
    expect(tracker.slop).toBe(DEFAULT_SLOP);
    expect(tracker.tapMs).toBe(DEFAULT_TAP_MS);
  });
});

describe("a tap", () => {
  it("is a touch that goes down and comes straight back up", () => {
    const tracker = createTracker();
    pointerDown(tracker, 100, 100, 1000);
    expect(pointerUp(tracker, 100, 100, 1120)).toEqual({ tap: true, x: 100, y: 100 });
  });

  it("survives the small slide a finger always makes", () => {
    const tracker = createTracker();
    pointerDown(tracker, 100, 100, 1000);
    expect(pointerMove(tracker, 104, 103).dragging).toBe(false);
    expect(pointerUp(tracker, 104, 103, 1100).tap).toBe(true);
  });

  it("reports where the finger landed, not where it left", () => {
    const tracker = createTracker();
    pointerDown(tracker, 100, 100, 1000);
    pointerMove(tracker, 107, 100);
    expect(pointerUp(tracker, 107, 100, 1100)).toEqual({ tap: true, x: 100, y: 100 });
  });

  it("is not a tap once the finger has travelled too far", () => {
    const tracker = createTracker();
    pointerDown(tracker, 100, 100, 1000);
    pointerMove(tracker, 200, 100);
    expect(pointerUp(tracker, 200, 100, 1100).tap).toBe(false);
  });

  it("is not a tap when the finger rests too long", () => {
    const tracker = createTracker();
    pointerDown(tracker, 100, 100, 1000);
    expect(pointerUp(tracker, 100, 100, 1000 + DEFAULT_TAP_MS + 1).tap).toBe(false);
  });

  it("stays a drag even if the finger wanders back to where it started", () => {
    const tracker = createTracker();
    pointerDown(tracker, 100, 100, 1000);
    pointerMove(tracker, 200, 100);
    pointerMove(tracker, 100, 100);
    expect(pointerUp(tracker, 100, 100, 1100).tap).toBe(false);
  });
});

describe("a drag", () => {
  it("does not start until the finger has passed the slop", () => {
    const tracker = createTracker({ slop: 10 });
    pointerDown(tracker, 100, 100, 1000);
    expect(pointerMove(tracker, 105, 100)).toEqual({ dragging: false, dx: 0, dy: 0 });
    expect(pointerMove(tracker, 111, 100)).toEqual({ dragging: true, dx: 11, dy: 0 });
  });

  it("hands over the whole distance travelled on the first move", () => {
    // Otherwise the map would visibly lag the finger by the slop distance.
    const tracker = createTracker({ slop: 10 });
    pointerDown(tracker, 100, 100, 1000);
    pointerMove(tracker, 106, 100);
    expect(pointerMove(tracker, 130, 100).dx).toBe(30);
  });

  it("reports each step separately once it has started", () => {
    const tracker = createTracker({ slop: 10 });
    pointerDown(tracker, 100, 100, 1000);
    pointerMove(tracker, 130, 100);
    expect(pointerMove(tracker, 150, 120)).toEqual({ dragging: true, dx: 20, dy: 20 });
    expect(pointerMove(tracker, 140, 130)).toEqual({ dragging: true, dx: -10, dy: 10 });
  });

  it("measures the slop as a distance, not per axis", () => {
    const tracker = createTracker({ slop: 10 });
    pointerDown(tracker, 100, 100, 1000);
    // 8 across and 8 down is a little over 11 away.
    expect(pointerMove(tracker, 108, 108).dragging).toBe(true);
  });

  it("adds up to the distance the finger actually covered", () => {
    const tracker = createTracker({ slop: 10 });
    pointerDown(tracker, 100, 100, 1000);
    let total = 0;
    for (const x of [140, 180, 220, 260]) {
      total += pointerMove(tracker, x, 100).dx;
    }
    expect(total).toBe(160);
  });
});

describe("a touch that never began", () => {
  it("moves nothing", () => {
    const tracker = createTracker();
    expect(pointerMove(tracker, 50, 50)).toEqual({ dragging: false, dx: 0, dy: 0 });
  });

  it("decides nothing on the way up", () => {
    const tracker = createTracker();
    expect(pointerUp(tracker, 50, 50, 1000)).toEqual({ tap: false, x: 0, y: 0 });
  });
});

describe("cancel", () => {
  it("drops the touch without deciding anything", () => {
    const tracker = createTracker();
    pointerDown(tracker, 100, 100, 1000);
    cancel(tracker);
    expect(tracker.active).toBe(false);
    expect(pointerUp(tracker, 100, 100, 1050).tap).toBe(false);
  });
});

describe("one touch after another", () => {
  it("forgets the previous drag when a new touch starts", () => {
    const tracker = createTracker({ slop: 10 });
    pointerDown(tracker, 100, 100, 1000);
    pointerMove(tracker, 300, 300);
    pointerUp(tracker, 300, 300, 1200);

    pointerDown(tracker, 50, 50, 2000);
    expect(tracker.dragging).toBe(false);
    expect(pointerUp(tracker, 50, 50, 2100).tap).toBe(true);
  });
});
