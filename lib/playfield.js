// Which cells of the square grid a puzzle is allowed to use.
//
// The grid is a square and the watch screen is a circle, so the corners of the
// grid land where the glass is not. An island put there is drawn into the bezel:
// on the smallest board the corner island was sliced in half before the player
// had touched anything, and on the largest one it sat 254 pixels outside the
// screen. Restricting a puzzle to the disc inscribed in its grid makes the shape
// of the board match the shape of the thing it is drawn on.
//
// Bridges need no rule of their own: a disc is convex, so a straight line
// between two cells inside it never leaves it.

// How far inside the circle a cell's centre has to be. Half a cell, so the whole
// of the island drawn in that cell is inside too - an island disc is a little
// over a third of a cell across, so this is the strict reading and still leaves
// room to spare. The smallest board keeps 29 of its 49 cells, and the islands
// may not touch each other anyway, which caps it near 13.
export const CELL_MARGIN = 0.5;

// The radius, in cells, of the usable disc.
export function playfieldRadius(cols, rows) {
  return Math.min(cols, rows) / 2 - CELL_MARGIN;
}

// Whether a cell may hold an island. Cells are addressed by their centre, which
// sits half a cell in from the corner of the grid.
export function isPlayable(cols, rows, col, row) {
  if (col < 0 || row < 0 || col >= cols || row >= rows) {
    return false;
  }
  const dx = col + 0.5 - cols / 2;
  const dy = row + 0.5 - rows / 2;
  return Math.sqrt(dx * dx + dy * dy) <= playfieldRadius(cols, rows);
}

// Every usable cell, in reading order. The generator picks its first island from
// this list, and the tests count it.
export function playableCells(cols, rows) {
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (isPlayable(cols, rows, col, row)) {
        cells.push({ col, row });
      }
    }
  }
  return cells;
}

// How many islands could be squeezed in at the very most: islands may not sit in
// touching cells, so no more than one of every two cells on a chequerboard. Used
// to check a difficulty is not asking for more islands than its board can hold.
export function islandCapacity(cols, rows) {
  let count = 0;
  const cells = playableCells(cols, rows);
  for (let i = 0; i < cells.length; i++) {
    if ((cells[i].col + cells[i].row) % 2 === 0) {
      count += 1;
    }
  }
  return count;
}
