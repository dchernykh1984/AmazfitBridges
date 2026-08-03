// One sitting at one board: the bridges laid so far, which island is selected,
// and the moves to undo. Pure, so the whole control scheme can be played out in
// a unit test without a watch.
//
// The control scheme it implements:
//   - tap an island to select it; the islands it can still reach light up
//   - tap one of those to cycle the bridge between them: none, one, two, none
//   - tap the selected island again, or empty water, to let it go
//   - tap a bridge itself to cycle it without selecting anything first
// An island that has just reached its number releases the selection on its own,
// because there is nothing more to do from it and the next tap is always
// somewhere else.

import {
  cloneState,
  edgeBetween,
  emptyState,
  isSolved,
  movesFrom,
  nextCount,
  remaining,
  satisfiedCount,
  withBridge,
} from "./puzzle.js";

function noChange(session) {
  return {
    changed: false,
    edges: [],
    selectionChanged: false,
    selection: session.selected,
    solved: false,
  };
}

// `changed` means the bridges changed, and only ever that: it is what tells the
// page whether a lane has to be repainted. Picking an island up or putting it
// down is reported separately, because it repaints something else entirely.
function selectionOnly(session, selected) {
  const selectionChanged = session.selected !== selected;
  session.selected = selected;
  return { changed: false, edges: [], selectionChanged, selection: selected, solved: false };
}

export function createSession(puzzle) {
  return {
    puzzle,
    state: emptyState(puzzle),
    selected: null,
    history: [],
    moves: 0,
    solved: false,
  };
}

// Lay, double or remove the bridge on one edge, recording it for undo. Returns
// what changed so the page can repaint one lane instead of the whole board.
export function applyEdge(session, edgeId) {
  const { puzzle } = session;
  if (session.solved || puzzle.edges[edgeId] === undefined) {
    return noChange(session);
  }

  const target = nextCount(puzzle, session.state, edgeId);
  const previous = session.state[edgeId];
  if (target === previous) {
    return noChange(session);
  }

  const next = withBridge(puzzle, session.state, edgeId, target);
  if (next === null) {
    return noChange(session);
  }

  session.history.push({ edgeId, count: previous });
  session.state = next;
  session.moves += 1;
  session.solved = isSolved(puzzle, session.state);

  // The island the player was working from is finished; holding on to it would
  // only mean an extra tap to let it go.
  let selectionChanged = false;
  if (session.selected !== null && remaining(puzzle, session.state, session.selected) === 0) {
    session.selected = null;
    selectionChanged = true;
  }

  return {
    changed: true,
    edges: [edgeId],
    selectionChanged,
    selection: session.selected,
    solved: session.solved,
  };
}

// A tap on an island: select it, let it go, or - when it is one of the selected
// island's reachable neighbours - change the bridge between the two.
export function tapIsland(session, islandId) {
  const { puzzle } = session;
  if (session.solved || puzzle.islands[islandId] === undefined) {
    return noChange(session);
  }
  if (session.selected === null) {
    return selectionOnly(session, islandId);
  }
  if (session.selected === islandId) {
    return selectionOnly(session, null);
  }

  const edgeId = edgeBetween(puzzle, session.selected, islandId);
  if (edgeId === null) {
    // Not a legal pair, so the tap means "I meant this one instead".
    return selectionOnly(session, islandId);
  }
  return applyEdge(session, edgeId);
}

// A tap on a bridge lane. Selection is left alone: the player is editing a
// bridge, not choosing where to build from.
export function tapEdge(session, edgeId) {
  return applyEdge(session, edgeId);
}

export function clearSelection(session) {
  return selectionOnly(session, null);
}

// Take back the last change. The stored count is written straight back rather
// than run through the rules, because it is a board state that was already
// legal - and undoing a removal can otherwise look like an illegal addition.
export function undo(session) {
  if (session.history.length === 0) {
    return noChange(session);
  }
  const move = session.history.pop();
  const next = cloneState(session.state);
  next[move.edgeId] = move.count;
  session.state = next;
  session.moves += 1;
  session.solved = isSolved(session.puzzle, session.state);

  return {
    changed: true,
    edges: [move.edgeId],
    selectionChanged: false,
    selection: session.selected,
    solved: session.solved,
  };
}

// Clear the board without generating a new one, for when a board has gone so
// wrong that undoing it one tap at a time is not worth it.
export function restart(session) {
  const edges = [];
  for (let edgeId = 0; edgeId < session.state.length; edgeId++) {
    if (session.state[edgeId] !== 0) {
      edges.push(edgeId);
    }
  }
  session.state = emptyState(session.puzzle);
  session.history = [];
  session.moves = 0;
  session.solved = false;
  const selectionChanged = session.selected !== null;
  session.selected = null;

  return { changed: edges.length > 0, edges, selectionChanged, selection: null, solved: false };
}

// The islands the selected one can still be joined to, for the page to draw as
// hints. Empty when nothing is selected.
export function selectionMoves(session) {
  if (session.selected === null) {
    return [];
  }
  return movesFrom(session.puzzle, session.state, session.selected);
}

// How far along the board is, as "islands finished / islands total".
export function progress(session) {
  return {
    done: satisfiedCount(session.puzzle, session.state),
    total: session.puzzle.islands.length,
  };
}

export function canUndo(session) {
  return session.history.length > 0;
}
