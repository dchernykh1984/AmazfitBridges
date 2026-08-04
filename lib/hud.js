// Where the controls sit on a round screen, and what a tap at a given point
// lands on. All of it is pure arithmetic over the screen diameter, so the whole
// interface can be laid out and clicked in a unit test.
//
// The app does its own hit testing rather than leaning on Zepp OS button
// widgets. Every touch arrives at a single transparent layer stacked above
// everything else, which is the only way to be sure that dragging the map is
// never swallowed by whichever widget happened to be under the finger when the
// drag started. The cost is that "which button was that" has to be worked out
// here - which is no cost at all, because here it is testable.

import { centeredBox } from "./round-geometry.js";

// The type scale and spacing of the stacked menus, as fractions of the screen
// diameter so the same numbers work on a 466px watch and a 480px one.
export function menuMetrics(screenSize) {
  return {
    big: Math.round(screenSize * 0.095),
    row: Math.round(screenSize * 0.072),
    small: Math.round(screenSize * 0.058),
    button: Math.round(screenSize * 0.115),
    gap: Math.round(screenSize * 0.025),
    maxWidth: Math.round(screenSize * 0.74),
    padding: Math.round(screenSize * 0.02),
  };
}

export function boxContains(box, x, y) {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

// The zone under a point. Zones are searched from the end, so the most recently
// added one - the one drawn on top - wins any overlap.
export function findZone(zones, x, y) {
  for (let i = zones.length - 1; i >= 0; i--) {
    if (boxContains(zones[i].box, x, y)) {
      return zones[i];
    }
  }
  return null;
}

// Lay a list of `{ kind, height }` rows out as a vertical stack centred on the
// screen, each row no wider than the round screen allows at its own height.
// Gaps take up space without producing a box.
export function stackLayout(screenSize, items, metrics) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].height;
  }

  const top = Math.round((screenSize - total) / 2);
  let y = top;
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== "gap") {
      rows.push({
        ...item,
        box: centeredBox(screenSize, y, item.height, metrics.maxWidth, metrics.padding),
      });
    }
    y += item.height;
  }

  // The panel behind the stack, which dims whatever board is showing through.
  // It runs the full width of the screen rather than being fitted to the circle
  // like the rows are: a panel narrowed to the chord at its tallest point comes
  // out narrower than the rows in the middle of it, leaving text hanging over
  // the edge of its own background. What spills into the corners is bezel, and
  // nobody can see it.
  const backdropTop = Math.max(0, top - metrics.gap);
  const backdrop = {
    x: 0,
    y: backdropTop,
    w: screenSize,
    h: Math.min(screenSize - backdropTop, total + 2 * metrics.gap),
  };

  return { rows, backdrop, top, height: total };
}

// The heads-up display shown while playing: the "islands finished" readout near
// the top, and the two actions along the bottom. Both are kept well inside the
// bezel, and the action bar is pulled up from the very bottom of the circle
// where a row this wide would be sliced in half.
export function hudLayout(screenSize) {
  const progressHeight = Math.round(screenSize * 0.08);
  const barHeight = Math.round(screenSize * 0.105);
  const barTop = Math.round(screenSize * 0.8);
  const padding = Math.round(screenSize * 0.02);
  const gap = Math.round(screenSize * 0.025);

  const bar = centeredBox(screenSize, barTop, barHeight, Math.round(screenSize * 0.66), padding);
  const buttonWidth = Math.floor((bar.w - gap) / 2);

  return {
    progress: centeredBox(
      screenSize,
      Math.round(screenSize * 0.045),
      progressHeight,
      Math.round(screenSize * 0.5),
      padding
    ),
    undo: { x: bar.x, y: bar.y, w: buttonWidth, h: bar.h },
    menu: { x: bar.x + buttonWidth + gap, y: bar.y, w: buttonWidth, h: bar.h },
  };
}

// The rows of the difficulty screen. The best time and the number of boards
// solved get a line each rather than sharing one: run together they come to
// twenty-five characters in the longer languages, which is more than a row this
// wide can show. The drag hint is dropped for a board that is fully visible from
// the start, because then there is nothing to drag towards.
export function startRows(metrics, showDragHint) {
  const rows = [
    { kind: "text", role: "title", height: metrics.big },
    { kind: "gap", height: metrics.gap },
    { kind: "text", role: "best", height: metrics.small },
    { kind: "text", role: "solved", height: metrics.small },
    { kind: "gap", height: metrics.gap },
    { kind: "text", role: "difficulty", height: metrics.small },
    { kind: "button", role: "level", height: metrics.button },
    { kind: "gap", height: metrics.gap },
    { kind: "button", role: "play", height: metrics.button },
    { kind: "gap", height: metrics.gap },
    { kind: "text", role: "hint_tap", height: metrics.small },
  ];
  if (showDragHint) {
    rows.push({ kind: "text", role: "hint_drag", height: metrics.small });
  }
  return rows;
}

export function pausedRows(metrics) {
  return [
    { kind: "text", role: "paused", height: metrics.big },
    { kind: "gap", height: metrics.gap },
    { kind: "button", role: "resume", height: metrics.button },
    { kind: "gap", height: metrics.gap },
    { kind: "button", role: "restart", height: metrics.button },
    { kind: "gap", height: metrics.gap },
    { kind: "button", role: "quit", height: metrics.button },
  ];
}

export function solvedRows(metrics) {
  return [
    { kind: "text", role: "well_done", height: metrics.big },
    { kind: "gap", height: metrics.gap },
    { kind: "text", role: "time", height: metrics.row },
    { kind: "text", role: "record", height: metrics.row },
    { kind: "gap", height: metrics.gap },
    { kind: "button", role: "again", height: metrics.button },
    { kind: "gap", height: metrics.gap },
    { kind: "button", role: "quit", height: metrics.button },
  ];
}
