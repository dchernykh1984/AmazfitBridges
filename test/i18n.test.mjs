import { describe, it, expect } from "vitest";
import { LABELS } from "../lib/i18n/labels.js";
import {
  ACTION_KEYS,
  budgetFor,
  LONG_KEYS,
  MAX_ACTION,
  MAX_HINT,
  MAX_LABEL,
  UI_KEYS,
} from "../lib/i18n/keys.js";
import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  labelFor,
  resolveLanguage,
  languageFromZeppCode,
} from "../lib/i18n/index.js";
import { hudLayout, menuMetrics, pausedRows, solvedRows, startRows } from "../lib/hud.js";
import { LEVELS } from "../lib/levels.js";

// The language list mirrors the sibling AmazfitRaceStats and AmazfitSerpent
// apps: the ten Zepp OS exposes as device languages, plus Kazakh.
const EXPECTED_LANGUAGES = ["en", "ru", "de", "fr", "it", "es", "pt", "nl", "pl", "cs", "kk"];

describe("locale completeness", () => {
  it("ships exactly the agreed language list", () => {
    expect([...LANGUAGES].sort()).toEqual([...EXPECTED_LANGUAGES].sort());
  });

  it("includes the default language", () => {
    expect(LANGUAGES).toContain(DEFAULT_LANGUAGE);
  });

  it("defines exactly the UI key set in every language", () => {
    const expected = [...UI_KEYS].sort();
    for (const lang of LANGUAGES) {
      expect(Object.keys(LABELS[lang]).sort(), lang).toEqual(expected);
    }
  });

  it("has a non-empty string within budget for every key in every language", () => {
    for (const lang of LANGUAGES) {
      for (const key of UI_KEYS) {
        const label = LABELS[lang][key];
        expect(typeof label, `${lang}/${key}`).toBe("string");
        expect(label.length, `${lang}/${key} '${label}'`).toBeGreaterThan(0);
        expect(label.length, `${lang}/${key} '${label}'`).toBeLessThanOrEqual(budgetFor(key));
      }
    }
  });

  it("never leaves a string as the untranslated English one by accident", () => {
    // A handful genuinely are the same word in several languages ("Menu",
    // "Pause"), so this only checks that no table is a wholesale copy.
    for (const lang of LANGUAGES) {
      if (lang === DEFAULT_LANGUAGE) {
        continue;
      }
      const shared = UI_KEYS.filter((key) => LABELS[lang][key] === LABELS.en[key]);
      expect(shared.length, `${lang} shares ${shared.join(", ")}`).toBeLessThan(UI_KEYS.length / 2);
    }
  });
});

describe("the label budgets", () => {
  it("narrows for the action bar and widens for a full-width line", () => {
    expect(MAX_ACTION).toBeLessThan(MAX_LABEL);
    expect(MAX_HINT).toBeGreaterThan(MAX_LABEL);
    for (const key of ACTION_KEYS) {
      expect(budgetFor(key)).toBe(MAX_ACTION);
    }
    for (const key of LONG_KEYS) {
      expect(budgetFor(key)).toBe(MAX_HINT);
    }
    expect(budgetFor("play")).toBe(MAX_LABEL);
  });

  it("only widens keys that are not drawn on a button", () => {
    const metrics = menuMetrics(480);
    const buttonRoles = new Set(
      [...startRows(metrics, true), ...pausedRows(metrics), ...solvedRows(metrics)]
        .filter((row) => row.kind === "button")
        .map((row) => row.role)
    );
    for (const key of LONG_KEYS) {
      expect(buttonRoles.has(key), `${key} is drawn on a button`).toBe(false);
    }
  });

  it("gives the narrow budget to exactly the two buttons in the action bar", () => {
    // hudLayout splits one chord between them, so they are the tightest labels
    // in the app - tighter than anything in a menu.
    expect([...ACTION_KEYS].sort()).toEqual(["menu", "undo"]);
    const hud = hudLayout(480);
    const menuButton = menuMetrics(480).maxWidth;
    expect(hud.undo.w).toBeLessThan(menuButton);
  });
});

describe("every screen has something to say", () => {
  it("names every difficulty in every language", () => {
    for (const level of LEVELS) {
      expect(UI_KEYS, level.label).toContain(level.label);
      for (const lang of LANGUAGES) {
        expect(LABELS[lang][level.label], `${lang}/${level.label}`).toBeTruthy();
      }
    }
  });

  it("has a string for every role the screens ask for", () => {
    const metrics = menuMetrics(480);
    const roles = [...startRows(metrics, true), ...pausedRows(metrics), ...solvedRows(metrics)]
      .filter((row) => row.role !== undefined)
      .map((row) => row.role);

    // Two rows are filled in rather than looked up: `record` is a label plus a
    // time, and `level` is whichever difficulty is selected. Everything else is
    // a key in its own right.
    const substitutes = { record: "best", level: LEVELS[0].label, time: "time" };
    for (const role of roles) {
      expect(UI_KEYS, role).toContain(substitutes[role] || role);
    }
  });

  it("has strings for the heads-up display and the notice while a board builds", () => {
    for (const key of ["undo", "menu", "generating"]) {
      expect(UI_KEYS).toContain(key);
    }
  });
});

describe("resolveLanguage", () => {
  it("maps a device locale to a supported 2-letter language", () => {
    expect(resolveLanguage("ru-RU")).toBe("ru");
    expect(resolveLanguage("en_US")).toBe("en");
    expect(resolveLanguage("kk-KZ")).toBe("kk");
    expect(resolveLanguage("de")).toBe("de");
  });

  it("falls back to the default for unknown or empty locales", () => {
    expect(resolveLanguage("ja-JP")).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage("")).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage(undefined)).toBe(DEFAULT_LANGUAGE);
  });
});

describe("languageFromZeppCode", () => {
  it("maps the Zepp OS integer language codes we translate", () => {
    expect(languageFromZeppCode(2)).toBe("en");
    expect(languageFromZeppCode(4)).toBe("ru");
    expect(languageFromZeppCode(22)).toBe("cs");
  });

  it("falls back to the default for codes we do not translate", () => {
    expect(languageFromZeppCode(0)).toBe(DEFAULT_LANGUAGE);
    expect(languageFromZeppCode(999)).toBe(DEFAULT_LANGUAGE);
    expect(languageFromZeppCode(undefined)).toBe(DEFAULT_LANGUAGE);
  });
});

describe("labelFor", () => {
  it("returns the localized string for a supported language", () => {
    expect(labelFor("ru", "play")).toBe(LABELS.ru.play);
    expect(labelFor("kk", "well_done")).toBe(LABELS.kk.well_done);
  });

  it("falls back to English, then to the raw key", () => {
    expect(labelFor("ja", "play")).toBe(LABELS.en.play);
    expect(labelFor("en", "not_a_key")).toBe("not_a_key");
  });
});
