import { describe, it, expect } from "vitest";
import {
  applyEdge,
  canUndo,
  clearSelection,
  createSession,
  progress,
  restart,
  selectionMoves,
  tapEdge,
  tapIsland,
  undo,
} from "../lib/session.js";
import { crossingPuzzle, edgeAtCells, linePuzzle, ringPuzzle } from "./fixtures.mjs";

// The line board is 1 - 2 - 1, so island 0 is the left one, 1 the middle and 2
// the right one.
function lineSession() {
  const puzzle = linePuzzle();
  return { puzzle, session: createSession(puzzle), left: 0, middle: 1, right: 2 };
}

describe("createSession", () => {
  it("starts on an empty board with nothing selected", () => {
    const { puzzle, session } = lineSession();
    expect(session.state).toEqual(puzzle.edges.map(() => 0));
    expect(session.selected).toBe(null);
    expect(session.solved).toBe(false);
    expect(canUndo(session)).toBe(false);
  });
});

describe("selecting an island", () => {
  it("picks it up", () => {
    const { session, left } = lineSession();
    const result = tapIsland(session, left);
    expect(session.selected).toBe(left);
    expect(result.selectionChanged).toBe(true);
    // Nothing was built, so no lane needs repainting.
    expect(result.changed).toBe(false);
    expect(result.edges).toEqual([]);
  });

  it("puts it back down when tapped again", () => {
    const { session, left } = lineSession();
    tapIsland(session, left);
    tapIsland(session, left);
    expect(session.selected).toBe(null);
  });

  it("moves the selection to an island it cannot reach", () => {
    const { session, left, right } = lineSession();
    tapIsland(session, left);
    const result = tapIsland(session, right);
    expect(session.selected).toBe(right);
    expect(result.changed).toBe(false);
  });

  it("is dropped by a tap on open water", () => {
    const { session, left } = lineSession();
    tapIsland(session, left);
    const result = clearSelection(session);
    expect(session.selected).toBe(null);
    expect(result.selectionChanged).toBe(true);
  });

  it("does nothing for an island that is not there", () => {
    const { session } = lineSession();
    expect(tapIsland(session, 99).changed).toBe(false);
    expect(session.selected).toBe(null);
  });
});

describe("building a bridge", () => {
  it("joins the selected island to the one tapped next", () => {
    const { puzzle, session, left, middle } = lineSession();
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    tapIsland(session, left);
    const result = tapIsland(session, middle);
    expect(session.state[edge]).toBe(1);
    expect(result.changed).toBe(true);
    expect(result.edges).toEqual([edge]);
  });

  it("cycles the same pair from one bridge to two by tapping it again", () => {
    // Every island on the ring board needs two bridges, so the selection stays
    // put until the second one goes in.
    const puzzle = ringPuzzle();
    const session = createSession(puzzle);
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    const a = puzzle.edges[edge].a;
    const b = puzzle.edges[edge].b;

    tapIsland(session, a);
    tapIsland(session, b);
    expect(session.state[edge]).toBe(1);
    expect(session.selected).toBe(a);

    tapIsland(session, b);
    expect(session.state[edge]).toBe(2);
    expect(session.selected).toBe(null);

    tapEdge(session, edge);
    expect(session.state[edge]).toBe(0);
  });

  it("lets go of an island the moment it is finished", () => {
    // The left island needs one bridge, so building it leaves nothing more to
    // do from there and holding the selection would only cost a tap.
    const { session, left, middle } = lineSession();
    tapIsland(session, left);
    const result = tapIsland(session, middle);
    expect(session.selected).toBe(null);
    expect(result.selectionChanged).toBe(true);
  });

  it("refuses a move that would overshoot an island's number", () => {
    const { puzzle, session, left, middle } = lineSession();
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    tapIsland(session, left);
    tapIsland(session, middle);
    // Selecting the middle and tapping the left again would need a second
    // bridge, which the left island has no room for, so it clears instead.
    tapIsland(session, middle);
    tapIsland(session, left);
    expect(session.state[edge]).toBe(0);
  });

  it("refuses to cross a bridge that is already there", () => {
    const puzzle = crossingPuzzle();
    const session = createSession(puzzle);
    const across = edgeAtCells(puzzle, [0, 1], [2, 1]);
    const down = edgeAtCells(puzzle, [1, 0], [1, 2]);

    tapEdge(session, across);
    expect(session.state[across]).toBe(1);
    const blocked = tapEdge(session, down);
    expect(blocked.changed).toBe(false);
    expect(session.state[down]).toBe(0);
  });
});

describe("tapping a bridge", () => {
  it("cycles it without needing anything selected", () => {
    const puzzle = ringPuzzle();
    const session = createSession(puzzle);
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    expect(tapEdge(session, edge).changed).toBe(true);
    expect(session.state[edge]).toBe(1);
  });

  it("leaves the selection where it was", () => {
    const puzzle = ringPuzzle();
    const session = createSession(puzzle);
    const island = puzzle.edges[0].a;
    const other = edgeAtCells(puzzle, [4, 0], [4, 2]);
    tapIsland(session, island);
    tapEdge(session, other);
    expect(session.selected).toBe(island);
  });

  it("does nothing for a lane that is not there", () => {
    const puzzle = ringPuzzle();
    const session = createSession(puzzle);
    expect(applyEdge(session, 999).changed).toBe(false);
  });
});

describe("selectionMoves", () => {
  it("is empty when nothing is selected", () => {
    const { session } = lineSession();
    expect(selectionMoves(session)).toEqual([]);
  });

  it("lists where the selected island can still build", () => {
    const puzzle = ringPuzzle();
    const session = createSession(puzzle);
    tapIsland(session, 0);
    const moves = selectionMoves(session);
    expect(moves.length).toBe(2);
    expect(moves.every((move) => move.buildable)).toBe(true);
  });
});

describe("undo", () => {
  it("takes the last bridge back", () => {
    const { puzzle, session, left, middle } = lineSession();
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    tapIsland(session, left);
    tapIsland(session, middle);
    expect(canUndo(session)).toBe(true);

    const result = undo(session);
    expect(session.state[edge]).toBe(0);
    expect(result.edges).toEqual([edge]);
    expect(canUndo(session)).toBe(false);
  });

  it("puts back a bridge that was removed", () => {
    const puzzle = ringPuzzle();
    const session = createSession(puzzle);
    const edge = edgeAtCells(puzzle, [0, 0], [2, 0]);
    tapEdge(session, edge);
    tapEdge(session, edge);
    tapEdge(session, edge);
    expect(session.state[edge]).toBe(0);
    undo(session);
    expect(session.state[edge]).toBe(2);
  });

  it("walks all the way back to an empty board", () => {
    const puzzle = ringPuzzle();
    const session = createSession(puzzle);
    for (const edge of puzzle.edges) {
      tapEdge(session, edge.id);
    }
    while (canUndo(session)) {
      undo(session);
    }
    expect(session.state).toEqual(puzzle.edges.map(() => 0));
  });

  it("does nothing on an untouched board", () => {
    const { session } = lineSession();
    expect(undo(session).changed).toBe(false);
  });
});

describe("restart", () => {
  it("clears the board and the history", () => {
    const puzzle = ringPuzzle();
    const session = createSession(puzzle);
    tapEdge(session, 0);
    tapIsland(session, 0);

    const result = restart(session);
    expect(session.state).toEqual(puzzle.edges.map(() => 0));
    expect(session.selected).toBe(null);
    expect(canUndo(session)).toBe(false);
    expect(result.edges).toEqual([0]);
  });

  it("reports nothing changed on a board that was already empty", () => {
    const { session } = lineSession();
    expect(restart(session).changed).toBe(false);
  });
});

describe("finishing a board", () => {
  function solveLine(session, puzzle) {
    tapEdge(session, edgeAtCells(puzzle, [0, 0], [2, 0]));
    return tapEdge(session, edgeAtCells(puzzle, [2, 0], [4, 0]));
  }

  it("notices the moment the last bridge goes in", () => {
    const { puzzle, session } = lineSession();
    const result = solveLine(session, puzzle);
    expect(result.solved).toBe(true);
    expect(session.solved).toBe(true);
  });

  it("stops taking moves once it is solved", () => {
    const { puzzle, session } = lineSession();
    solveLine(session, puzzle);
    const after = tapEdge(session, edgeAtCells(puzzle, [0, 0], [2, 0]));
    expect(after.changed).toBe(false);
    expect(tapIsland(session, 0).changed).toBe(false);
  });

  it("is not solved when the numbers add up but the board is in pieces", () => {
    // Two ones joined to each other and a third pair elsewhere would satisfy
    // every number; this board has no such trap, so the ring stands in: filling
    // the middle rung instead of the outer ring splits nothing but does leave
    // numbers unmet.
    const puzzle = ringPuzzle();
    const session = createSession(puzzle);
    tapEdge(session, edgeAtCells(puzzle, [2, 0], [2, 2]));
    expect(session.solved).toBe(false);
  });

  it("can be undone back out of the solved state", () => {
    const { puzzle, session } = lineSession();
    solveLine(session, puzzle);
    undo(session);
    expect(session.solved).toBe(false);
    expect(tapEdge(session, edgeAtCells(puzzle, [2, 0], [4, 0])).solved).toBe(true);
  });
});

describe("progress", () => {
  it("counts the islands that are finished", () => {
    const { puzzle, session } = lineSession();
    expect(progress(session)).toEqual({ done: 0, total: 3 });
    tapEdge(session, edgeAtCells(puzzle, [0, 0], [2, 0]));
    expect(progress(session)).toEqual({ done: 1, total: 3 });
    tapEdge(session, edgeAtCells(puzzle, [2, 0], [4, 0]));
    expect(progress(session)).toEqual({ done: 3, total: 3 });
  });
});
