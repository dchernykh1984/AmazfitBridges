// Two ways of writing a board down, and the conversions between them.
//
// The source of truth in the repository is an ASCII grid, one character per
// cell, because a board you can read in a diff is a board you can argue about:
//
//     ...3...
//     .2...4.
//     .......
//     4...5..
//
// What the watch imports is the same board packed to three characters per
// island - column, row, number - which is less than half the size and needs no
// scanning. `lib/boards.js` is generated from the grids and holds the packed
// form; a unit test decodes both and insists they agree, so the two can never
// drift apart.

export const EMPTY_CELL = ".";
export const COMMENT_PREFIX = ";";

// Columns and rows are written in base 36, so a single character covers any grid
// up to 36 wide - far past the 13 the largest difficulty uses.
const RADIX = 36;

function isDigitChar(character) {
  return character >= "1" && character <= "8";
}

// ------------------------------------------------------------------ grids ----

// The islands of one board as an ASCII grid.
export function encodeGrid(islands, cols, rows) {
  const lines = [];
  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < cols; col++) {
      const island = islands.find((entry) => entry.col === col && entry.row === row);
      line += island === undefined ? EMPTY_CELL : String(island.required);
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// One ASCII grid back into islands, or null when the text is not a grid at all.
// Returning null rather than throwing keeps a corrupt line in a data file from
// taking the whole collection down with it; the caller decides what to do.
export function decodeGrid(text) {
  const lines = String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return null;
  }
  const cols = lines[0].length;
  const islands = [];

  for (let row = 0; row < lines.length; row++) {
    if (lines[row].length !== cols) {
      return null;
    }
    for (let col = 0; col < cols; col++) {
      const character = lines[row][col];
      if (character === EMPTY_CELL) {
        continue;
      }
      if (!isDigitChar(character)) {
        return null;
      }
      islands.push({ col, row, required: Number(character) });
    }
  }

  return { cols, rows: lines.length, islands };
}

// ------------------------------------------------------------------ packs ----

// One board as three characters per island. Islands are written in reading
// order, which is the order buildPuzzle would put them in anyway.
export function packBoard(islands) {
  if (islands.length === 0) {
    // A board with no islands packs to nothing, and nothing is not a code
    // unpackBoard will accept. Say so here rather than writing a record that
    // cannot be read back.
    return null;
  }
  const sorted = islands.slice().sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));

  let packed = "";
  for (let i = 0; i < sorted.length; i++) {
    packed +=
      sorted[i].col.toString(RADIX) + sorted[i].row.toString(RADIX) + String(sorted[i].required);
  }
  return packed;
}

// A packed board back into islands, or null when the code is malformed. The
// watch runs this on data it shipped with, so it should never fail - but a board
// that fails to unpack must not be able to crash the game either.
export function unpackBoard(code) {
  const text = String(code);
  if (text.length === 0 || text.length % 3 !== 0) {
    return null;
  }

  const islands = [];
  for (let i = 0; i < text.length; i += 3) {
    const col = parseInt(text[i], RADIX);
    const row = parseInt(text[i + 1], RADIX);
    if (!Number.isInteger(col) || !Number.isInteger(row) || !isDigitChar(text[i + 2])) {
      return null;
    }
    islands.push({ col, row, required: Number(text[i + 2]) });
  }
  return islands;
}

// ------------------------------------------------------------ collections ----

// A whole file: some comment lines, then the grids separated by blank lines.
export function encodeCollection(boards, cols, rows, comments) {
  const head = (comments || []).map((line) => COMMENT_PREFIX + " " + line).join("\n");
  const grids = boards.map((islands) => encodeGrid(islands, cols, rows));
  const blocks = head.length > 0 ? [head].concat(grids) : grids;
  return blocks.join("\n\n") + "\n";
}

// Every grid in a file. Comment lines are dropped, blank lines separate boards.
// Returns `{ cols, rows, boards }`, or null when any board in the file is
// malformed - a data file is all-or-nothing, because a silently short
// collection is worse than a loud failure.
export function decodeCollection(text) {
  const blocks = String(text)
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .filter((line) => line.trim().length > 0 && line.trim()[0] !== COMMENT_PREFIX)
        .join("\n")
    )
    .filter((block) => block.trim().length > 0);

  if (blocks.length === 0) {
    return null;
  }

  const boards = [];
  let cols = 0;
  let rows = 0;

  for (let i = 0; i < blocks.length; i++) {
    const grid = decodeGrid(blocks[i]);
    if (grid === null) {
      return null;
    }
    if (i === 0) {
      cols = grid.cols;
      rows = grid.rows;
    } else if (grid.cols !== cols || grid.rows !== rows) {
      // Every board in a file belongs to one difficulty, so they are all the
      // same size; a stray one means the file was edited by hand and got out of
      // step with its header.
      return null;
    }
    boards.push(grid.islands);
  }

  return { cols, rows, boards };
}
