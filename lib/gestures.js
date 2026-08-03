// Telling a tap from a drag. The board is played with taps and moved with
// drags, and both arrive as the same stream of touch-down, touch-move and
// touch-up events - so something has to decide which one just happened. That
// decision is here, pure and unit tested, rather than buried in the page where
// the only way to check it is to poke a watch.
//
// The rule is the usual one: a touch that never travels more than the slop, and
// lets go quickly enough, is a tap. Anything else is a drag, and once a touch
// has become a drag it stays one - so a finger that wanders and comes back does
// not fire an accidental move on the board.

// The defaults are in pixels and milliseconds against a ~480px watch screen. The
// slop is generous because a finger on a small screen always slides a little,
// and the time limit is loose because a careful tap on a board this size is not
// a quick one.
export const DEFAULT_SLOP = 14;
export const DEFAULT_TAP_MS = 700;

export function createTracker(options) {
  const settings = options || {};
  return {
    slop: Number.isFinite(settings.slop) ? settings.slop : DEFAULT_SLOP,
    tapMs: Number.isFinite(settings.tapMs) ? settings.tapMs : DEFAULT_TAP_MS,
    active: false,
    dragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
  };
}

export function pointerDown(tracker, x, y, time) {
  tracker.active = true;
  tracker.dragging = false;
  tracker.startX = x;
  tracker.startY = y;
  tracker.lastX = x;
  tracker.lastY = y;
  tracker.startTime = time;
}

// The movement since the last event, and whether this touch counts as a drag
// yet. The delta is always reported so the very first movement past the slop
// still shifts the map by the whole distance travelled, rather than throwing
// away the part of it that got the touch over the threshold.
export function pointerMove(tracker, x, y) {
  if (!tracker.active) {
    return { dragging: false, dx: 0, dy: 0 };
  }
  const dx = x - tracker.lastX;
  const dy = y - tracker.lastY;
  tracker.lastX = x;
  tracker.lastY = y;

  if (!tracker.dragging) {
    const totalX = x - tracker.startX;
    const totalY = y - tracker.startY;
    if (Math.sqrt(totalX * totalX + totalY * totalY) > tracker.slop) {
      tracker.dragging = true;
      return { dragging: true, dx: x - tracker.startX, dy: y - tracker.startY };
    }
    return { dragging: false, dx: 0, dy: 0 };
  }

  return { dragging: true, dx, dy };
}

// What the touch turned out to be. A tap reports where it landed - the start
// point, not the release point, because that is where the player was aiming.
export function pointerUp(tracker, x, y, time) {
  if (!tracker.active) {
    return { tap: false, x: 0, y: 0 };
  }
  const dx = x - tracker.startX;
  const dy = y - tracker.startY;
  const travelled = Math.sqrt(dx * dx + dy * dy);
  const held = time - tracker.startTime;
  const tap = !tracker.dragging && travelled <= tracker.slop && held <= tracker.tapMs;

  tracker.active = false;
  tracker.dragging = false;
  return { tap, x: tracker.startX, y: tracker.startY };
}

// Drop the touch without deciding anything, for when the page goes away
// mid-drag.
export function cancel(tracker) {
  tracker.active = false;
  tracker.dragging = false;
}
