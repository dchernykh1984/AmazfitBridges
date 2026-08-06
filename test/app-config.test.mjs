import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LABELS } from "../lib/i18n/labels.js";
import { LANGUAGES } from "../lib/i18n/index.js";
import { budgetFor } from "../lib/i18n/keys.js";

const root = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const appJson = JSON.parse(readFileSync(root("app.json"), "utf8"));
const packageJson = JSON.parse(readFileSync(root("package.json"), "utf8"));

// app.json carries the store identity, and nothing else would catch it
// regressing: the release build only runs on a release or a manual dispatch,
// never on a pull request, so the first thing that would otherwise exercise a
// wrong id is a manual store submission.
//
// The version lives in the same file but is checked in app-version.test.mjs,
// which knows the one moment the two numbers in it are allowed to disagree.
describe("app.json", () => {
  it("carries the app id the game is registered under in the Zepp store", () => {
    // Registered as "Island Bridges". An unregistered or placeholder id installs
    // on the watch but silently refuses to launch, so this one is pinned.
    expect(Number.isInteger(appJson.app.appId)).toBe(true);
    expect(appJson.app.appId).toBe(1122446);
  });

  it("gives the store, the launcher and every locale the same name", () => {
    expect(appJson.app.appName).toBe("Island Bridges");
    for (const locale of Object.keys(appJson.i18n)) {
      expect(appJson.i18n[locale].appName, locale).toBe(appJson.app.appName);
    }
    // The app's own name reads the same in every language rather than being
    // translated, which is why the i18n block repeats it rather than varying it.
    expect(Object.keys(appJson.i18n).length).toBeGreaterThan(0);
    expect(appJson.i18n[appJson.defaultLanguage], appJson.defaultLanguage).toBeTruthy();
  });

  it("shows a shorter name on the start screen than the store listing uses", () => {
    // Deliberate, and the reason the store name is not simply reused: the title
    // row allows budgetFor("title") characters and "Island Bridges" is longer.
    // The heading is also the one name here that is translated.
    const budget = budgetFor("title");
    expect(appJson.app.appName.length).toBeGreaterThan(budget);
    for (const language of LANGUAGES) {
      expect(LABELS[language].title.length, language).toBeLessThanOrEqual(budget);
    }
    expect(LABELS.en.title).toBe("Bridges");
    // Translated, not repeated: at least one language says it differently.
    const distinct = new Set(LANGUAGES.map((language) => LABELS[language].title));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("is the same project the package is", () => {
    expect(packageJson.name).toBe("amazfit-bridges");
    expect(appJson.app.vender.length).toBeGreaterThan(0);
    expect(appJson.app.description.length).toBeGreaterThan(0);
  });

  it("is built for round screens only, which is the only shape the layout handles", () => {
    const platforms = appJson.targets.common.platforms;
    expect(platforms.length).toBeGreaterThan(0);
    for (const platform of platforms) {
      expect(platform.st, JSON.stringify(platform)).toBe("r");
      expect(platform.dw).toBeGreaterThan(0);
    }
    expect(platforms.map((platform) => platform.dw).sort((a, b) => a - b)).toEqual([466, 480]);
  });

  it("ships the one page the app has and the icon it names", () => {
    expect(appJson.targets.common.module.page.pages).toEqual(["page/index"]);
    expect(appJson.app.icon).toBe("icon.png");
    expect(() => readFileSync(root("assets/common.r/icon.png"))).not.toThrow();
  });

  it("asks for the permissions the page actually uses", () => {
    // The page reads the screen size and remembers records in local storage.
    expect(appJson.permissions).toContain("data:os.device.info");
    expect(appJson.permissions).toContain("device:os.local_storage");
  });
});
