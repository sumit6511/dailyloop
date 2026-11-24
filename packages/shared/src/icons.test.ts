import { describe, it, expect } from "vitest";
import { ICON_NAMES, isIconName } from "./icons.js";
import { ACHIEVEMENT_CATALOG } from "./achievements.js";

describe("ICON_NAMES", () => {
  it("is sorted and unique (Google Fonts requires sorted icon_names)", () => {
    expect([...ICON_NAMES]).toEqual([...new Set(ICON_NAMES)].sort());
  });

  it("only contains valid Material Symbols name syntax", () => {
    for (const name of ICON_NAMES) expect(name).toMatch(/^[a-z0-9_]+$/);
  });

  it("covers every achievement icon", () => {
    for (const achievement of ACHIEVEMENT_CATALOG) expect(isIconName(achievement.icon)).toBe(true);
  });
});
