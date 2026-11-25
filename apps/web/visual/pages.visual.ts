import { test, expect } from "@playwright/test";
import { SCREENS, openScreen } from "./support";

for (const screen of SCREENS) {
  test(screen.name, async ({ page }) => {
    await openScreen(page, screen);
    await expect(page).toHaveScreenshot(`${screen.name}.png`, { fullPage: true });
  });
}
