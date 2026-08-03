// Colors drawn on the (black) watch screen. The board is read at arm's length in
// daylight, so the islands are solid blocks of colour that say what state they
// are in without the player having to compare numbers: dark blue still needs
// bridges, green is finished, orange is the one you are building from.
export const COLOR_BACKGROUND = 0x000000;
export const COLOR_ISLAND = 0x1d3557;
export const COLOR_ISLAND_DONE = 0x2a9d5c;
export const COLOR_ISLAND_SELECTED = 0xe07b39;
export const COLOR_ISLAND_RING = 0xffb066;
export const COLOR_NUMBER = 0xffffff;
export const COLOR_NUMBER_DONE = 0xeafff2;
export const COLOR_BRIDGE = 0xa8c6df;
export const COLOR_GHOST = 0x33414f;
export const COLOR_TEXT = 0xffffff;
export const COLOR_MUTED = 0x93a1ad;
export const COLOR_ACCENT = 0xf0a202;
export const COLOR_BUTTON = 0x1a2027;
export const COLOR_BUTTON_PRESSED = 0x2f3d46;
export const COLOR_PANEL = 0x000000;

// How opaque the panel behind a stacked menu is. Not fully opaque, so the board
// underneath still shows through and the menu reads as something laid over the
// game rather than a different screen.
export const PANEL_ALPHA = 225;

// The touch layer sits above every other widget so that no widget can swallow a
// drag. It has to be drawn to be touchable, so it is drawn as close to invisible
// as a colour gets.
export const TOUCH_LAYER_ALPHA = 1;

// The board never repaints faster than this while a drag is in flight. Touch
// events arrive faster than a hundred-odd widgets can be moved, and without a
// floor the queue of half-finished repaints is what the player feels as lag.
export const PAN_FRAME_MS = 40;

// How long the screen stays lit while the app is open. A puzzle is thought about
// rather than tapped at, and a ten-second display timeout would black out
// mid-deduction, so the page asks for ten minutes and hands the setting back
// when it closes.
export const BRIGHT_TIME_MS = 600000;
