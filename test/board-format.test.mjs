import { describe, it, expect } from "vitest";
import {
  decodeCollection,
  decodeGrid,
  encodeCollection,
  encodeGrid,
  packBoard,
  unpackBoard,
} from "../lib/board-format.js";
import { generatePuzzle } from "../lib/generator.js";
import { LEVELS } from "../lib/levels.js";

const ISLANDS = [
  { col: 3, row: 0, required: 3 },
  { col: 1, row: 1, required: 2 },
  { col: 5, row: 1, required: 4 },
  { col: 0, row: 3, required: 4 },
];

const GRID = ["...3...", ".2...4.", ".......", "4......", ".......", ".......", "......."].join(
  "\n"
);

describe("encodeGrid", () => {
  it("draws one character per cell", () => {
    expect(encodeGrid(ISLANDS, 7, 7)).toBe(GRID);
  });

  it("draws an empty board as all dots", () => {
    expect(encodeGrid([], 3, 2)).toBe("...\n...");
  });
});

describe("decodeGrid", () => {
  it("reads the islands back out", () => {
    const grid = decodeGrid(GRID);
    expect(grid.cols).toBe(7);
    expect(grid.rows).toBe(7);
    expect(grid.islands).toEqual(ISLANDS);
  });

  it("round-trips any grid", () => {
    expect(decodeGrid(encodeGrid(ISLANDS, 7, 7)).islands).toEqual(ISLANDS);
  });

  it("ignores surrounding blank space", () => {
    expect(decodeGrid("\n  ...3...  \n  .2...4.  \n").islands.length).toBe(3);
  });

  it("refuses a ragged grid", () => {
    expect(decodeGrid("...\n....")).toBe(null);
  });

  it("refuses a character that is neither a dot nor an island number", () => {
    expect(decodeGrid("..x")).toBe(null);
    expect(decodeGrid("..0")).toBe(null);
    expect(decodeGrid("..9")).toBe(null);
  });

  it("refuses nothing at all", () => {
    expect(decodeGrid("")).toBe(null);
    expect(decodeGrid("   \n  ")).toBe(null);
  });
});

describe("packBoard and unpackBoard", () => {
  it("uses three characters per island", () => {
    expect(packBoard(ISLANDS).length).toBe(ISLANDS.length * 3);
  });

  it("round-trips", () => {
    expect(unpackBoard(packBoard(ISLANDS))).toEqual(ISLANDS);
  });

  it("writes islands in reading order whatever order they came in", () => {
    const shuffled = [ISLANDS[2], ISLANDS[0], ISLANDS[3], ISLANDS[1]];
    expect(packBoard(shuffled)).toBe(packBoard(ISLANDS));
  });

  it("copes with a grid wider than ten cells", () => {
    const wide = [{ col: 12, row: 11, required: 8 }];
    expect(unpackBoard(packBoard(wide))).toEqual(wide);
    expect(packBoard(wide)).toBe("cb8");
  });

  it("refuses a code of the wrong length", () => {
    expect(unpackBoard("")).toBe(null);
    expect(unpackBoard("ab")).toBe(null);
    expect(unpackBoard("ab34")).toBe(null);
  });

  it("refuses a code with an impossible island number", () => {
    expect(unpackBoard("ab0")).toBe(null);
    expect(unpackBoard("ab9")).toBe(null);
    expect(unpackBoard("abz")).toBe(null);
  });

  it("is much shorter than the grid it came from", () => {
    const packed = packBoard(ISLANDS).length;
    expect(packed).toBeLessThan(encodeGrid(ISLANDS, 7, 7).length / 3);
  });
});

describe("collections", () => {
  const boards = [ISLANDS, [{ col: 2, row: 2, required: 1 }]];

  it("round-trips a whole file", () => {
    const text = encodeCollection(boards, 7, 7, ["a header", "and another line"]);
    const back = decodeCollection(text);
    expect(back.cols).toBe(7);
    expect(back.rows).toBe(7);
    expect(back.boards).toEqual(boards);
  });

  it("keeps the comments out of the boards", () => {
    const text = encodeCollection(boards, 7, 7, ["note"]);
    expect(text.startsWith("; note")).toBe(true);
    expect(decodeCollection(text).boards.length).toBe(2);
  });

  it("survives a file with no comments", () => {
    expect(decodeCollection(encodeCollection(boards, 7, 7, [])).boards.length).toBe(2);
  });

  it("refuses a file whose boards are not all the same size", () => {
    const mixed = "...\n...\n...\n\n....\n....\n....\n....";
    expect(decodeCollection(mixed)).toBe(null);
  });

  it("refuses a file with a malformed board", () => {
    expect(decodeCollection("...\n...\n\n..x\n...")).toBe(null);
  });

  it("refuses an empty file", () => {
    expect(decodeCollection("")).toBe(null);
    expect(decodeCollection("; only a comment\n")).toBe(null);
  });

  it("ends with a newline, so the file is well formed for the hooks", () => {
    expect(encodeCollection(boards, 7, 7, ["x"]).endsWith("\n")).toBe(true);
  });
});

describe("against real generated boards", () => {
  it("round-trips every difficulty through both formats", () => {
    for (const level of LEVELS) {
      for (const seed of [1, 2, 3]) {
        const board = generatePuzzle(level, seed);
        const islands = board.puzzle.islands.map((island) => ({
          col: island.col,
          row: island.row,
          required: island.required,
        }));

        const viaGrid = decodeGrid(encodeGrid(islands, level.cols, level.rows));
        expect(viaGrid.islands, level.id).toEqual(islands);
        expect(viaGrid.cols, level.id).toBe(level.cols);

        expect(unpackBoard(packBoard(islands)), level.id).toEqual(islands);
      }
    }
  });
});
