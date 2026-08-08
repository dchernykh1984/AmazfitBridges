import { describe, it, expect } from "vitest";
import {
  BUILT_IN,
  clampSource,
  DEFAULT_SOURCE,
  GENERATED,
  nextSource,
  SOURCE_KEY,
  sourceLabel,
  SOURCES,
} from "../lib/sources.js";
import { UI_KEYS } from "../lib/i18n/keys.js";

describe("the two sources", () => {
  it("offers the shipped collection and a board rolled on the watch", () => {
    expect(SOURCES).toEqual([BUILT_IN, GENERATED]);
  });

  it("starts a fresh install on the collection", () => {
    // It is the better experience: every board in it has been proved twice.
    expect(DEFAULT_SOURCE).toBe(BUILT_IN);
  });

  it("remembers the choice under a stable key", () => {
    expect(SOURCE_KEY).toBe("source");
  });

  it("uses values that survive a round trip through storage as text", () => {
    for (const source of SOURCES) {
      expect(typeof source).toBe("string");
      expect(clampSource(String(source))).toBe(source);
    }
  });
});

describe("clampSource", () => {
  it("keeps a source it knows", () => {
    expect(clampSource(BUILT_IN)).toBe(BUILT_IN);
    expect(clampSource(GENERATED)).toBe(GENERATED);
  });

  it("falls back for anything else", () => {
    expect(clampSource("nonsense")).toBe(DEFAULT_SOURCE);
    expect(clampSource(undefined)).toBe(DEFAULT_SOURCE);
    expect(clampSource(null)).toBe(DEFAULT_SOURCE);
    expect(clampSource("")).toBe(DEFAULT_SOURCE);
    expect(clampSource(0)).toBe(DEFAULT_SOURCE);
  });
});

describe("nextSource", () => {
  it("walks through both and comes back round", () => {
    expect(nextSource(BUILT_IN)).toBe(GENERATED);
    expect(nextSource(GENERATED)).toBe(BUILT_IN);
  });

  it("recovers from a corrupt stored source", () => {
    expect(nextSource("nonsense")).toBe(nextSource(DEFAULT_SOURCE));
  });

  it("visits every source before repeating", () => {
    const seen = new Set();
    let source = DEFAULT_SOURCE;
    for (let i = 0; i < SOURCES.length; i++) {
      seen.add(source);
      source = nextSource(source);
    }
    expect(seen.size).toBe(SOURCES.length);
    expect(source).toBe(DEFAULT_SOURCE);
  });
});

describe("sourceLabel", () => {
  it("names each source with a key the screens can show", () => {
    expect(sourceLabel(BUILT_IN)).toBe("source_builtin");
    expect(sourceLabel(GENERATED)).toBe("source_random");
    for (const source of SOURCES) {
      expect(UI_KEYS).toContain(sourceLabel(source));
    }
  });

  it("gives the two sources different names", () => {
    expect(sourceLabel(BUILT_IN)).not.toBe(sourceLabel(GENERATED));
  });

  it("names something even for a corrupt source", () => {
    expect(UI_KEYS).toContain(sourceLabel("nonsense"));
  });
});
