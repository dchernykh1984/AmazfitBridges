import * as hmUI from "@zos/ui";
import { getLanguage } from "@zos/settings";
import { onGesture, offGesture, GESTURE_RIGHT } from "@zos/interaction";
import { setPageBrightTime, resetPageBrightTime } from "@zos/display";
import { LocalStorage } from "@zos/storage";

import { bridgeRects, createLayout, hitTest, islandCenter } from "../lib/board-geometry.js";
import { boxToScreen, centerCamera, needsPanning, panBy, toWorld } from "../lib/camera.js";
import { generatePuzzle } from "../lib/generator.js";
import { createTracker, pointerDown, pointerMove, pointerUp, cancel } from "../lib/gestures.js";
import {
  findZone,
  hudLayout,
  menuMetrics,
  pausedRows,
  solvedRows,
  stackLayout,
  startRows,
} from "../lib/hud.js";
import { labelFor, languageFromZeppCode } from "../lib/i18n/index.js";
import { clampLevel, LEVELS, levelConfig, nextLevel } from "../lib/levels.js";
import {
  bestTimeKey,
  clockSeconds,
  createClock,
  formatTime,
  LEVEL_KEY,
  normalizeCount,
  normalizeTime,
  pauseClock,
  solvedKey,
  startClock,
  updateBestTime,
} from "../lib/progress.js";
import { remaining } from "../lib/puzzle.js";
import {
  canUndo,
  createSession,
  progress,
  restart,
  selectionMoves,
  tapEdge,
  tapIsland,
  clearSelection,
  undo,
} from "../lib/session.js";
import { clipToScreen } from "../lib/round-geometry.js";
import { SCREEN_SIZE } from "../utils/config/device.js";
import {
  BRIGHT_TIME_MS,
  COLOR_ACCENT,
  COLOR_BACKGROUND,
  COLOR_BRIDGE,
  COLOR_BUTTON,
  COLOR_BUTTON_PRESSED,
  COLOR_GHOST,
  COLOR_ISLAND,
  COLOR_ISLAND_DONE,
  COLOR_ISLAND_RING,
  COLOR_ISLAND_SELECTED,
  COLOR_MUTED,
  COLOR_NUMBER,
  COLOR_NUMBER_DONE,
  COLOR_PANEL,
  COLOR_TEXT,
  PAN_FRAME_MS,
  PANEL_ALPHA,
  TOUCH_LAYER_ALPHA,
} from "../utils/config/constants.js";

const METRICS = menuMetrics(SCREEN_SIZE);
const HUD = hudLayout(SCREEN_SIZE);

// The most bridge lanes one island can offer, and therefore how many "you could
// build here" hints ever need drawing at once: one per compass direction.
const MAX_HINTS = 4;

// Where a widget is parked when it is off screen. Zepp OS has no way to take a
// widget out of the drawing list short of deleting it, and deleting a hundred
// widgets per drag frame is not an option, so they are moved somewhere the
// screen is not instead. That somewhere is the bottom-right corner of the
// bounding square, which on a round watch is bezel rather than glass - a legal
// coordinate that nobody can see.
const PARKED = { x: SCREEN_SIZE - 1, y: SCREEN_SIZE - 1, w: 1, h: 1 };

// A widget that failed to take a setting is not worth crashing a game over, and
// a watch that has no storage should still play - just without remembering. The
// in-memory copy keeps the records alive for the rest of the session.
const memory = {};

function readValue(storage, key) {
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      // Fall through to the in-memory copy.
    }
  }
  return memory[key];
}

function writeValue(storage, key, value) {
  memory[key] = value;
  if (storage) {
    try {
      storage.setItem(key, value);
    } catch {
      // The in-memory copy above still holds for this session.
    }
  }
}

Page({
  state: {
    language: "en",
    level: 0,
    best: 0,
    solved: 0,
    screen: "start",
    storage: null,
    destroyed: false,

    puzzle: null,
    session: null,
    layout: null,
    camera: { x: 0, y: 0 },
    clock: null,

    tracker: null,
    pressed: null,
    // Tappable rectangles, split by what owns them: the action bar under a board
    // and the buttons of whichever menu is open. `zones` is the flattened list
    // the touch layer actually searches.
    zones: [],
    hudZones: [],
    menuZones: [],
    lastDrawAt: 0,
    panPending: false,
    buildTimer: null,

    // Widgets, grouped by lifetime. The background outlives the page; the board
    // widgets outlive a game; the HUD and the menu outlive a screen; the touch
    // layer is rebuilt whenever something is drawn on top of it, because it has
    // to stay above everything to catch a drag that starts on an island.
    ghosts: [],
    edges: [],
    ring: null,
    islands: [],
    hud: [],
    menu: [],
    progressText: null,
    touchLayer: null,
  },

  build() {
    try {
      this.state.language = languageFromZeppCode(getLanguage());
    } catch {
      // Some firmwares do not expose the setting; English rather than a blank
      // screen from a throw inside build().
    }

    try {
      this.state.storage = new LocalStorage();
    } catch {
      // No storage on this device: play on, remembering only for this session.
    }

    // A puzzle is thought about rather than tapped at, and a screen that blacks
    // out mid-deduction loses the player's place. Handed back in onDestroy.
    try {
      setPageBrightTime({ brightTime: BRIGHT_TIME_MS });
    } catch {
      // Not fatal: the watch just keeps its own timeout.
    }

    this.state.tracker = createTracker({});
    this.state.level = clampLevel(readValue(this.state.storage, LEVEL_KEY));
    this.loadRecords();

    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN_SIZE,
      h: SCREEN_SIZE,
      color: COLOR_BACKGROUND,
    });

    onGesture({ callback: (event) => this.onGesture(event) });
    this.showStart();
  },

  onDestroy() {
    this.state.destroyed = true;
    if (this.state.buildTimer !== null) {
      clearTimeout(this.state.buildTimer);
      this.state.buildTimer = null;
    }
    try {
      offGesture();
    } catch {
      // Nothing left to unhook.
    }
    try {
      resetPageBrightTime();
    } catch {
      // The setting is dropped with the page anyway.
    }
  },

  // ---------------------------------------------------------------- input ----

  // The only gesture the game cares about is the one it has to refuse. Dragging
  // the map sideways looks exactly like the system's back swipe, so while a
  // board is open every gesture is swallowed and the way out is the menu button.
  // The difficulty screen lets the back swipe through, which is how you leave
  // the app.
  onGesture(gesture) {
    if (this.state.destroyed) {
      return false;
    }
    if (this.state.screen === "start" && gesture === GESTURE_RIGHT) {
      return false;
    }
    return true;
  },

  onTouchDown(info) {
    if (this.state.destroyed) {
      return;
    }
    pointerDown(this.state.tracker, info.x, info.y, Date.now());
    this.setPressed(findZone(this.state.zones, info.x, info.y));
  },

  onTouchMove(info) {
    if (this.state.destroyed) {
      return;
    }
    const move = pointerMove(this.state.tracker, info.x, info.y);
    if (!move.dragging) {
      return;
    }
    // Once it is a drag it is no longer a button press.
    this.setPressed(null);
    if (this.state.screen === "playing") {
      this.panBoard(move.dx, move.dy);
    }
  },

  onTouchUp(info) {
    if (this.state.destroyed) {
      return;
    }
    const zone = this.state.pressed;
    this.setPressed(null);
    const result = pointerUp(this.state.tracker, info.x, info.y, Date.now());
    this.flushPan();

    if (!result.tap) {
      return;
    }
    if (zone !== null) {
      this.runAction(zone.role);
      return;
    }
    if (this.state.screen === "playing") {
      this.tapBoard(result.x, result.y);
    }
  },

  // The finger left the screen without letting go. Nothing can be decided from
  // that, so the touch is dropped and whatever the drag moved is committed.
  onTouchOut() {
    if (this.state.destroyed) {
      return;
    }
    this.setPressed(null);
    cancel(this.state.tracker);
    this.flushPan();
  },

  // A tap that missed every control: work out what it hit on the board. The
  // point is in screen pixels and the board thinks in world pixels, so it is
  // shifted by the camera first.
  tapBoard(x, y) {
    const { camera, layout, puzzle, session } = this.state;
    const point = toWorld(camera, x, y);
    const hit = hitTest(puzzle, layout, point.x, point.y);

    let result;
    if (hit === null) {
      result = clearSelection(session);
    } else if (hit.type === "island") {
      result = tapIsland(session, hit.id);
    } else {
      result = tapEdge(session, hit.id);
    }

    this.applyResult(result);
  },

  // Repaint only what the move touched: the lane that changed, the islands at
  // either end of it, and the selection hints. Repainting the whole board for
  // one bridge is what makes a watch feel slow.
  applyResult(result) {
    if (result.changed) {
      for (let i = 0; i < result.edges.length; i++) {
        const edge = this.state.puzzle.edges[result.edges[i]];
        this.positionEdge(result.edges[i]);
        this.positionIsland(edge.a);
        this.positionIsland(edge.b);
      }
      this.updateProgress();
    }
    if (result.changed || result.selectionChanged) {
      this.positionHints();
      this.positionRing();
    }
    if (result.solved) {
      this.showSolved();
    }
  },

  // ---------------------------------------------------------------- panning ----

  // The map follows the finger. The camera itself is two numbers and costs
  // nothing to update, but moving a hundred widgets does, so the repaint is
  // capped to a frame rate and whatever is left over is committed when the
  // finger comes up.
  panBoard(dx, dy) {
    this.state.camera = panBy(this.state.camera, dx, dy, this.state.layout, SCREEN_SIZE);
    const now = Date.now();
    if (now - this.state.lastDrawAt >= PAN_FRAME_MS) {
      this.state.lastDrawAt = now;
      this.state.panPending = false;
      this.positionBoard();
      return;
    }
    this.state.panPending = true;
  },

  flushPan() {
    if (!this.state.panPending) {
      return;
    }
    this.state.panPending = false;
    this.state.lastDrawAt = Date.now();
    if (this.state.puzzle !== null) {
      this.positionBoard();
    }
  },

  // ---------------------------------------------------------------- actions ----

  // Which screen a control belongs to is checked here rather than by hiding its
  // zone, because a menu panel does not always cover the action bar underneath
  // it - and a stale Undo tapped through a "solved" panel would quietly unpick
  // the board the player just finished.
  runAction(role) {
    const screen = this.state.screen;
    if (role === "level" && screen === "start") {
      this.cycleLevel();
    } else if (role === "play" && screen === "start") {
      this.startGame();
    } else if (role === "again" && screen === "solved") {
      this.startGame();
    } else if (role === "undo" && screen === "playing") {
      this.applyResult(undo(this.state.session));
    } else if (role === "menu" && screen === "playing") {
      this.showPaused();
    } else if (role === "resume" && screen === "paused") {
      this.resumeGame();
    } else if (role === "restart" && screen === "paused") {
      this.restartBoard();
    } else if (role === "quit" && (screen === "paused" || screen === "solved")) {
      this.showStart();
    }
  },

  cycleLevel() {
    this.state.level = nextLevel(this.state.level);
    writeValue(this.state.storage, LEVEL_KEY, this.state.level);
    this.loadRecords();
    this.showStart();
  },

  loadRecords() {
    this.state.best = normalizeTime(readValue(this.state.storage, bestTimeKey(this.state.level)));
    this.state.solved = normalizeCount(readValue(this.state.storage, solvedKey(this.state.level)));
  },

  // ---------------------------------------------------------------- screens ----

  showStart() {
    this.state.screen = "start";
    this.clearBoard();
    this.clearHud();
    this.state.puzzle = null;
    this.state.session = null;
    this.state.clock = null;

    const config = levelConfig(this.state.level);
    const layout = createLayout(SCREEN_SIZE, config.cols, config.rows);
    const record = this.state.best === 0 ? "--:--" : formatTime(this.state.best);

    this.drawMenu(startRows(METRICS, needsPanning(layout, SCREEN_SIZE)), {
      title: { text: this.text("title"), color: COLOR_TEXT },
      best: { text: this.text("best") + " " + record, color: COLOR_MUTED },
      solved: { text: this.text("solved") + " " + this.state.solved, color: COLOR_MUTED },
      difficulty: { text: this.text("difficulty"), color: COLOR_MUTED },
      level: { text: this.text(LEVELS[this.state.level].label) },
      play: { text: this.text("play") },
      hint_tap: { text: this.text("hint_tap"), color: COLOR_MUTED },
      hint_drag: { text: this.text("hint_drag"), color: COLOR_MUTED },
    });
  },

  // Building a board is a fraction of a second of solid arithmetic, which is
  // long enough to look like a frozen watch. The notice is drawn first and the
  // work is handed to a timer, so the screen has repainted before the thread is
  // taken.
  startGame() {
    this.state.screen = "generating";
    this.clearBoard();
    this.clearHud();
    this.drawMenu([{ kind: "text", role: "generating", height: METRICS.row }], {
      generating: { text: this.text("generating"), color: COLOR_TEXT },
    });
    this.state.buildTimer = setTimeout(() => this.beginPuzzle(), 40);
  },

  beginPuzzle() {
    this.state.buildTimer = null;
    if (this.state.destroyed || this.state.screen !== "generating") {
      return;
    }

    const config = levelConfig(this.state.level);
    const seed = Date.now() + Math.floor(Math.random() * 0xffff);
    const generated = generatePuzzle(config, seed);
    if (generated === null) {
      // Nothing legal came out of the whole retry budget, which should not
      // happen; showing the menu again beats showing a blank board.
      this.showStart();
      return;
    }

    this.state.puzzle = generated.puzzle;
    this.state.session = createSession(generated.puzzle);
    this.state.layout = createLayout(SCREEN_SIZE, generated.puzzle.cols, generated.puzzle.rows);
    this.state.camera = centerCamera(this.state.layout, SCREEN_SIZE);
    this.state.clock = startClock(createClock(), Date.now());

    this.clearMenu();
    this.state.screen = "playing";
    this.buildBoard();
    this.drawHud();
    this.positionBoard();
    this.raiseTouchLayer();
  },

  showPaused() {
    if (this.state.screen !== "playing") {
      return;
    }
    this.state.screen = "paused";
    pauseClock(this.state.clock, Date.now());
    this.drawMenu(pausedRows(METRICS), {
      paused: { text: this.text("paused"), color: COLOR_TEXT },
      resume: { text: this.text("resume") },
      restart: { text: this.text("restart") },
      quit: { text: this.text("quit") },
    });
  },

  resumeGame() {
    if (this.state.screen !== "paused") {
      return;
    }
    this.clearMenu();
    this.state.screen = "playing";
    startClock(this.state.clock, Date.now());
    this.raiseTouchLayer();
  },

  restartBoard() {
    if (this.state.session === null) {
      return;
    }
    restart(this.state.session);
    this.clearMenu();
    this.state.screen = "playing";
    startClock(this.state.clock, Date.now());
    this.positionBoard();
    this.updateProgress();
    this.raiseTouchLayer();
  },

  // The finished board is left on screen under the panel: the point of the game
  // is the picture you just made, so it would be a shame to cover it entirely.
  showSolved() {
    this.state.screen = "solved";
    const now = Date.now();
    const seconds = clockSeconds(this.state.clock, now);
    pauseClock(this.state.clock, now);

    const record = updateBestTime(this.state.best, seconds);
    this.state.best = record.best;
    if (record.isRecord) {
      writeValue(this.state.storage, bestTimeKey(this.state.level), record.best);
    }
    this.state.solved += 1;
    writeValue(this.state.storage, solvedKey(this.state.level), this.state.solved);

    this.drawMenu(solvedRows(METRICS), {
      well_done: { text: this.text("well_done"), color: COLOR_TEXT },
      time: { text: this.text("time") + " " + formatTime(seconds), color: COLOR_TEXT },
      record: record.isRecord
        ? { text: this.text("new_best"), color: COLOR_ACCENT }
        : { text: this.text("best") + " " + formatTime(this.state.best), color: COLOR_MUTED },
      again: { text: this.text("again") },
      quit: { text: this.text("quit") },
    });
  },

  // ---------------------------------------------------------------- board ----

  // Every widget a board will ever need is created up front and then only moved
  // and recoloured. Creating widgets mid-game would put them above the touch
  // layer, and rebuilding that layer on every tap is work the game does not need
  // to do.
  buildBoard() {
    const { puzzle, layout } = this.state;

    this.state.ghosts = [];
    for (let i = 0; i < MAX_HINTS; i++) {
      this.state.ghosts.push(this.createParkedRect(COLOR_GHOST));
    }

    this.state.edges = [];
    for (let edgeId = 0; edgeId < puzzle.edges.length; edgeId++) {
      this.state.edges.push([
        this.createParkedRect(COLOR_BRIDGE),
        this.createParkedRect(COLOR_BRIDGE),
      ]);
    }

    this.state.ring = this.createParkedRect(COLOR_ISLAND_RING);

    this.state.islands = [];
    for (let id = 0; id < puzzle.islands.length; id++) {
      this.state.islands.push({
        disc: this.createParkedRect(COLOR_ISLAND),
        label: this.createParkedText(layout.numberSize, String(puzzle.islands[id].required)),
      });
    }
  },

  positionBoard() {
    if (this.state.puzzle === null) {
      return;
    }
    for (let edgeId = 0; edgeId < this.state.puzzle.edges.length; edgeId++) {
      this.positionEdge(edgeId);
    }
    this.positionHints();
    this.positionRing();
    for (let id = 0; id < this.state.puzzle.islands.length; id++) {
      this.positionIsland(id);
    }
  },

  positionEdge(edgeId) {
    const { layout, puzzle, session } = this.state;
    const rects = bridgeRects(layout, puzzle, edgeId, session.state[edgeId]);
    const entries = this.state.edges[edgeId];

    for (let i = 0; i < entries.length; i++) {
      if (i >= rects.length) {
        this.park(entries[i]);
        continue;
      }
      this.place(entries[i], boxToScreen(this.state.camera, rects[i]), COLOR_BRIDGE, 0);
    }
  },

  positionIsland(id) {
    const { layout, puzzle, session } = this.state;
    const centre = islandCenter(layout, puzzle.islands[id]);
    const size = layout.radius * 2;
    const box = boxToScreen(this.state.camera, {
      x: centre.x - layout.radius,
      y: centre.y - layout.radius,
      w: size,
      h: size,
    });
    const entry = this.state.islands[id];

    const done = remaining(puzzle, session.state, id) === 0;
    const selected = session.selected === id;
    const fill = selected ? COLOR_ISLAND_SELECTED : done ? COLOR_ISLAND_DONE : COLOR_ISLAND;

    this.place(entry.disc, box, fill, layout.radius);
    this.placeText(entry.label, box, done && !selected ? COLOR_NUMBER_DONE : COLOR_NUMBER);
  },

  // The halo behind the island being built from. It is one widget created below
  // the discs, so it can only ever show around whichever island is selected.
  positionRing() {
    const { layout, puzzle, session } = this.state;
    if (session.selected === null) {
      this.park(this.state.ring);
      return;
    }
    const centre = islandCenter(layout, puzzle.islands[session.selected]);
    const outer = layout.radius + Math.max(2, Math.round(layout.cell * 0.06));
    this.place(
      this.state.ring,
      boxToScreen(this.state.camera, {
        x: centre.x - outer,
        y: centre.y - outer,
        w: outer * 2,
        h: outer * 2,
      }),
      COLOR_ISLAND_RING,
      outer
    );
  },

  // Dim lanes showing where the selected island can still build. Only the moves
  // that would add a bridge are drawn: a lane whose next tap merely clears it is
  // already visible as a bridge.
  positionHints() {
    const { layout, puzzle, session } = this.state;
    const moves = selectionMoves(session).filter((move) => move.buildable);

    for (let i = 0; i < this.state.ghosts.length; i++) {
      if (i >= moves.length) {
        this.park(this.state.ghosts[i]);
        continue;
      }
      const lane = bridgeRects(layout, puzzle, moves[i].edgeId, 1)[0];
      this.place(this.state.ghosts[i], boxToScreen(this.state.camera, lane), COLOR_GHOST, 0);
    }
  },

  createParkedRect(color) {
    return {
      widget: hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: PARKED.x,
        y: PARKED.y,
        w: PARKED.w,
        h: PARKED.h,
        radius: 0,
        color,
      }),
      parked: true,
    };
  },

  createParkedText(size, text) {
    return {
      widget: hmUI.createWidget(hmUI.widget.TEXT, {
        x: PARKED.x,
        y: PARKED.y,
        w: PARKED.w,
        h: PARKED.h,
        color: COLOR_NUMBER,
        text_size: size,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text_style: hmUI.text_style.NONE,
        text,
      }),
      parked: true,
      size,
      text,
    };
  },

  // Move a rectangle to where it belongs, or off the screen when it does not
  // belong anywhere visible. The box is trimmed to the glass first, so a widget
  // hanging off a dragged board is never given a negative coordinate; the corner
  // radius is trimmed with it, because a rounded rectangle whose radius is more
  // than half its width has nothing sensible to draw. The parked flag keeps a
  // widget that is already away from being told so again on every frame.
  place(entry, box, color, radius) {
    const visible = clipToScreen(SCREEN_SIZE, box);
    if (visible === null) {
      this.park(entry);
      return;
    }
    entry.widget.setProperty(hmUI.prop.MORE, {
      x: visible.x,
      y: visible.y,
      w: visible.w,
      h: visible.h,
      radius: Math.min(radius, Math.floor(Math.min(visible.w, visible.h) / 2)),
      color,
    });
    entry.parked = false;
  },

  // An island's number rides along with its disc. The box is trimmed the same
  // way, which nudges a half-hidden number a pixel or two off the middle of its
  // island - at the very edge of a round screen, where the bezel has most of it
  // anyway.
  placeText(entry, box, color) {
    const visible = clipToScreen(SCREEN_SIZE, box);
    if (visible === null) {
      this.park(entry);
      return;
    }
    entry.widget.setProperty(hmUI.prop.MORE, {
      x: visible.x,
      y: visible.y,
      w: visible.w,
      h: visible.h,
      color,
      text_size: entry.size,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
      text: entry.text,
    });
    entry.parked = false;
  },

  park(entry) {
    if (entry.parked) {
      return;
    }
    const props = { x: PARKED.x, y: PARKED.y, w: PARKED.w, h: PARKED.h };
    if (entry.size !== undefined) {
      props.text_size = entry.size;
      props.text = entry.text;
      props.color = COLOR_NUMBER;
    } else {
      props.radius = 0;
      props.color = COLOR_BACKGROUND;
    }
    entry.widget.setProperty(hmUI.prop.MORE, props);
    entry.parked = true;
  },

  clearBoard() {
    const groups = [this.state.ghosts, this.state.islands, this.state.edges];
    for (let g = 0; g < groups.length; g++) {
      this.deleteEntries(groups[g]);
    }
    this.state.ghosts = [];
    this.state.edges = [];
    this.state.islands = [];
    if (this.state.ring !== null) {
      hmUI.deleteWidget(this.state.ring.widget);
      this.state.ring = null;
    }
  },

  // Board widgets are stored as entries, as pairs of entries, and as arrays of
  // entries; one walk handles all three rather than three near-identical loops.
  deleteEntries(items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (Array.isArray(item)) {
        this.deleteEntries(item);
      } else if (item.widget !== undefined) {
        hmUI.deleteWidget(item.widget);
      } else {
        this.deleteEntries([item.disc, item.label]);
      }
    }
  },

  // ---------------------------------------------------------------- hud ----

  drawHud() {
    this.clearHud();
    this.state.hud.push(
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: HUD.progress.x,
        y: HUD.progress.y,
        w: HUD.progress.w,
        h: HUD.progress.h,
        radius: Math.round(HUD.progress.h / 2),
        color: COLOR_BUTTON,
        alpha: PANEL_ALPHA,
      })
    );
    this.state.progressText = this.createText(
      HUD.progress,
      Math.round(HUD.progress.h * 0.55),
      COLOR_TEXT,
      ""
    );
    this.state.hud.push(this.state.progressText);

    this.addButton(this.state.hud, this.state.hudZones, HUD.undo, this.text("undo"), "undo");
    this.addButton(this.state.hud, this.state.hudZones, HUD.menu, this.text("menu"), "menu");
    this.rebuildZones();
    this.updateProgress();
  },

  updateProgress() {
    if (!this.state.progressText || this.state.session === null) {
      return;
    }
    const done = progress(this.state.session);
    this.state.progressText.setProperty(hmUI.prop.MORE, {
      x: HUD.progress.x,
      y: HUD.progress.y,
      w: HUD.progress.w,
      h: HUD.progress.h,
      color: done.done === done.total ? COLOR_ACCENT : COLOR_TEXT,
      text_size: Math.round(HUD.progress.h * 0.55),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
      text: done.done + "/" + done.total,
    });
    this.setZoneEnabled("undo", canUndo(this.state.session));
  },

  clearHud() {
    for (let i = 0; i < this.state.hud.length; i++) {
      hmUI.deleteWidget(this.state.hud[i]);
    }
    this.state.hud = [];
    this.state.hudZones = [];
    this.state.progressText = null;
    this.rebuildZones();
  },

  // ---------------------------------------------------------------- menus ----

  // A vertical stack of texts and buttons, centred under a dimmed panel so it
  // stays readable over a half-built board.
  drawMenu(rows, content) {
    this.clearMenu();
    const stack = stackLayout(SCREEN_SIZE, rows, METRICS);

    this.state.menu.push(
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: stack.backdrop.x,
        y: stack.backdrop.y,
        w: stack.backdrop.w,
        h: stack.backdrop.h,
        color: COLOR_PANEL,
        alpha: PANEL_ALPHA,
      })
    );

    for (let i = 0; i < stack.rows.length; i++) {
      const row = stack.rows[i];
      const item = content[row.role] || { text: "" };
      if (row.kind === "button") {
        this.addButton(this.state.menu, this.state.menuZones, row.box, item.text, row.role);
      } else {
        this.state.menu.push(
          this.createText(
            row.box,
            Math.round(row.box.h * 0.78),
            item.color || COLOR_TEXT,
            item.text
          )
        );
      }
    }

    this.rebuildZones();
    this.raiseTouchLayer();
  },

  clearMenu() {
    for (let i = 0; i < this.state.menu.length; i++) {
      hmUI.deleteWidget(this.state.menu[i]);
    }
    this.state.menu = [];
    this.state.menuZones = [];
    this.rebuildZones();
  },

  // ---------------------------------------------------------------- widgets ----

  createText(box, size, color, text) {
    return hmUI.createWidget(hmUI.widget.TEXT, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      color,
      text_size: size,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
      text,
    });
  },

  // Buttons are drawn rather than created as button widgets, because every touch
  // is routed through the one layer on top and dispatched by lib/hud.js. What is
  // registered here is the rectangle it paints and the zone it answers to.
  addButton(bucket, zones, box, text, role) {
    const rect = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      radius: Math.round(box.h / 2),
      color: COLOR_BUTTON,
    });
    const size = Math.round(box.h * 0.42);
    const label = this.createText(box, size, COLOR_TEXT, text);
    bucket.push(rect, label);
    zones.push({ box, role, rect, label, text, size, enabled: true });
  },

  // The HUD sits under the menu, so its zones are listed first and the menu's
  // win any overlap - which is what stops a pause menu drawn across the action
  // bar from letting the buttons underneath be tapped through it.
  rebuildZones() {
    const zones = [];
    for (let i = 0; i < this.state.hudZones.length; i++) {
      if (this.state.hudZones[i].enabled) {
        zones.push(this.state.hudZones[i]);
      }
    }
    for (let i = 0; i < this.state.menuZones.length; i++) {
      zones.push(this.state.menuZones[i]);
    }
    this.state.zones = zones;
  },

  // Undo dims when there is nothing to take back, so a tap on it is never a
  // silent no-op. The button keeps its shape and only its label greys out: a
  // control that vanishes and comes back is harder to aim at than one that
  // simply looks unavailable.
  setZoneEnabled(role, enabled) {
    for (let i = 0; i < this.state.hudZones.length; i++) {
      const zone = this.state.hudZones[i];
      if (zone.role !== role || zone.enabled === enabled) {
        continue;
      }
      zone.enabled = enabled;
      zone.label.setProperty(hmUI.prop.MORE, {
        x: zone.box.x,
        y: zone.box.y,
        w: zone.box.w,
        h: zone.box.h,
        color: enabled ? COLOR_TEXT : COLOR_GHOST,
        text_size: zone.size,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V,
        text_style: hmUI.text_style.NONE,
        text: zone.text,
      });
      this.rebuildZones();
    }
  },

  setPressed(zone) {
    if (this.state.pressed === zone) {
      return;
    }
    if (this.state.pressed !== null) {
      this.paintZone(this.state.pressed, COLOR_BUTTON);
    }
    this.state.pressed = zone;
    if (zone !== null) {
      this.paintZone(zone, COLOR_BUTTON_PRESSED);
    }
  },

  paintZone(zone, color) {
    zone.rect.setProperty(hmUI.prop.MORE, {
      x: zone.box.x,
      y: zone.box.y,
      w: zone.box.w,
      h: zone.box.h,
      radius: Math.round(zone.box.h / 2),
      color,
    });
  },

  // The touch layer has to be the topmost widget or a drag that starts on an
  // island is swallowed by the island. Widgets cannot be reordered once created,
  // so it is thrown away and made again whenever anything is drawn on top.
  raiseTouchLayer() {
    if (this.state.touchLayer !== null) {
      hmUI.deleteWidget(this.state.touchLayer);
      this.state.touchLayer = null;
    }
    const layer = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN_SIZE,
      h: SCREEN_SIZE,
      color: COLOR_BACKGROUND,
      alpha: TOUCH_LAYER_ALPHA,
    });
    layer.addEventListener(hmUI.event.CLICK_DOWN, (info) => this.onTouchDown(info));
    layer.addEventListener(hmUI.event.MOVE, (info) => this.onTouchMove(info));
    layer.addEventListener(hmUI.event.CLICK_UP, (info) => this.onTouchUp(info));
    layer.addEventListener(hmUI.event.MOVE_OUT, () => this.onTouchOut());
    this.state.touchLayer = layer;
  },

  text(key) {
    return labelFor(this.state.language, key);
  },
});
