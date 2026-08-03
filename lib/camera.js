// The map camera: which part of the world the round screen is looking at. The
// board is dragged the way a map is dragged in a navigator - the finger moves
// the map, not the viewport - and this module owns where that is allowed to
// stop. Pure, so the panning limits are unit tested rather than discovered by
// dragging the board off the edge of a watch.
//
// The camera is the world coordinate that sits at the top-left corner of the
// screen: screen = world - camera. One number per axis, no zoom - pinching on a
// 46mm screen is not a gesture anyone wants to perform.

// How far past the ordinary limit the map may be dragged, as a fraction of the
// screen. A square board on a round screen has its corners cut off by the bezel,
// so stopping the drag exactly at the edge of the board would leave the corner
// islands permanently half-hidden. This much slack is enough to pull any corner
// of any of the shipped boards well inside the glass, and little enough that the
// board never flies off into empty space.
const OVERSCROLL_RATIO = 0.18;

export function overscrollFor(viewSize) {
  return Math.round(viewSize * OVERSCROLL_RATIO);
}

// How far the camera may travel on one axis: the ordinary "keep the board
// covering the screen" limits, widened by the overscroll. A board smaller than
// the screen has no such limits to widen, so it is centred and given the same
// slack either way.
export function axisBounds(worldSize, viewSize, overscroll) {
  if (worldSize <= viewSize) {
    const centre = (worldSize - viewSize) / 2;
    return { min: centre - overscroll, max: centre + overscroll };
  }
  return { min: -overscroll, max: worldSize - viewSize + overscroll };
}

export function clampAxis(value, worldSize, viewSize, overscroll) {
  const bounds = axisBounds(worldSize, viewSize, overscroll);
  if (!Number.isFinite(value)) {
    return bounds.min;
  }
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

export function clampCamera(camera, layout, viewSize) {
  const overscroll = overscrollFor(viewSize);
  return {
    x: clampAxis(camera.x, layout.width, viewSize, overscroll),
    y: clampAxis(camera.y, layout.height, viewSize, overscroll),
  };
}

// Where the map starts: the middle of the board in the middle of the screen.
export function centerCamera(layout, viewSize) {
  return clampCamera(
    { x: (layout.width - viewSize) / 2, y: (layout.height - viewSize) / 2 },
    layout,
    viewSize
  );
}

// Drag the map by a finger movement. The map follows the finger, so the camera
// moves the opposite way.
export function panBy(camera, dx, dy, layout, viewSize) {
  return clampCamera({ x: camera.x - dx, y: camera.y - dy }, layout, viewSize);
}

// Put a world point as near the middle of the screen as the limits allow.
export function centerOn(worldX, worldY, layout, viewSize) {
  return clampCamera({ x: worldX - viewSize / 2, y: worldY - viewSize / 2 }, layout, viewSize);
}

export function toScreen(camera, x, y) {
  return { x: Math.round(x - camera.x), y: Math.round(y - camera.y) };
}

export function toWorld(camera, x, y) {
  return { x: x + camera.x, y: y + camera.y };
}

// Whether a disc of the given radius, centred at this screen point, is entirely
// within the round glass.
function discIsOnScreen(viewSize, x, y, radius) {
  const centre = viewSize / 2;
  const dx = x - centre;
  const dy = y - centre;
  return Math.sqrt(dx * dx + dy * dy) + radius <= centre;
}

// Whether any of the board is out of sight when it is first shown, and the
// player will therefore have to drag to see all of it. The four corner cells
// are the only ones worth asking about: on a round screen they are the first to
// be lost to the bezel, and if they are visible everything else is too.
export function needsPanning(layout, viewSize) {
  const camera = centerCamera(layout, viewSize);
  const corners = [
    [0, 0],
    [layout.cols - 1, 0],
    [0, layout.rows - 1],
    [layout.cols - 1, layout.rows - 1],
  ];
  for (let i = 0; i < corners.length; i++) {
    const x = (corners[i][0] + 0.5) * layout.cell - camera.x;
    const y = (corners[i][1] + 0.5) * layout.cell - camera.y;
    if (!discIsOnScreen(viewSize, x, y, layout.radius)) {
      return true;
    }
  }
  return false;
}

// Whether every cell of the board can be brought fully into view by dragging.
// The generator may put an island in any cell, so a board that fails this has a
// cell the player could never properly see.
export function everyCellReachable(layout, viewSize) {
  const overscroll = overscrollFor(viewSize);
  const horizontal = axisBounds(layout.width, viewSize, overscroll);
  const vertical = axisBounds(layout.height, viewSize, overscroll);

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const worldX = (col + 0.5) * layout.cell;
      const worldY = (row + 0.5) * layout.cell;
      const x = worldX - Math.min(horizontal.max, Math.max(horizontal.min, worldX - viewSize / 2));
      const y = worldY - Math.min(vertical.max, Math.max(vertical.min, worldY - viewSize / 2));
      if (!discIsOnScreen(viewSize, x, y, layout.radius)) {
        return false;
      }
    }
  }
  return true;
}
