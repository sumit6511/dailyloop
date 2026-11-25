import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { SCREENS, openScreen } from "./support";

/**
 * Accessibility checks with axe-core on every screen, in every project (desktop/phone ×
 * dark/light): WCAG 2.1 A/AA plus axe's best practices. Contrast is the one most likely to
 * regress — a new muted colour, or a tint that only fails in the light theme.
 */
for (const screen of SCREENS) {
  test(`a11y: ${screen.name}`, async ({ page }) => {
    await openScreen(page, screen);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();
    const summary = violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`,
    );
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
