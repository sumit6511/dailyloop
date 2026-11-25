import { test, expect, type APIRequestContext } from "@playwright/test";

const API = "http://localhost:4100/api";

/** Today's Guess It answer, read through the admin API (the dev seed's admin account). */
async function todaysGuessItAnswer(request: APIRequestContext): Promise<string> {
  const login = await request.post(`${API}/auth/login`, {
    data: { emailOrUsername: "admin", password: "DevAdmin123!" },
  });
  expect(login.ok(), "the dev seed's admin can log in").toBe(true);
  const schedule = await (await request.get(`${API}/games/schedule`)).json();
  const today: string = schedule.data.today;
  // Opening today's puzzle once makes sure it exists (it's generated on first request).
  await request.get(`${API}/games/guess-it/today`);
  const list = await (
    await request.get(`${API}/admin/puzzles?gameSlug=guess-it&date=${today}`)
  ).json();
  const answer = list.data?.[0]?.content?.answer;
  expect(typeof answer, "today's Guess It puzzle exists").toBe("string");
  return answer;
}

test("a new player signs up, plays a game, and shows up on the leaderboard", async ({
  page,
  request,
}) => {
  const answer = await todaysGuessItAnswer(request);
  const suffix = Date.now().toString(36);
  const username = `e2e_${suffix}`;
  const displayName = `E2E ${suffix}`;
  const password = "e2e-password-123";

  await test.step("sign up", async () => {
    await page.goto("/register");
    await page.getByLabel("Display name").fill(displayName);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Email").fill(`${username}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: /Create account/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(displayName);
    await expect(page).toHaveTitle("Today · DailyLoop");
  });

  let score = 0;
  await test.step("play Guess It: one wrong guess, then the answer", async () => {
    await page.locator('a[href="/play/guess-it"]').click();
    // First visit: the rules open by themselves.
    const rules = page.getByRole("dialog", { name: "How to play Guess It" });
    await expect(rules).toBeVisible();
    await rules.getByRole("button", { name: /Got it/ }).click();

    const input = page.getByLabel("Your guess");
    await input.fill("definitely not the answer");
    await page.getByRole("button", { name: "Guess", exact: true }).click();
    await expect(page.getByText("Clue 2", { exact: true })).toBeVisible();
    // The wrong guess clears the field, which then shakes (disabled) for a moment.
    await expect(input).toHaveValue("");
    await expect(input).toBeEnabled();

    await input.fill(answer);
    await page.getByRole("button", { name: "Guess", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nice work!" })).toBeVisible();
    const scoreText = await page.getByText(/^Score: \d+ out of 100$/).textContent();
    score = Number(/Score: (\d+)/.exec(scoreText ?? "")![1]);
    expect(score).toBeGreaterThan(0);
  });

  await test.step("the dashboard and leaderboard show the result", async () => {
    await page.getByRole("button", { name: /Back to today/ }).click();
    const card = page
      .locator("div")
      .filter({ has: page.locator('a[href="/play/guess-it"]') })
      .last();
    await expect(card.getByText("Solved")).toBeVisible();
    await expect(card.getByText(`${score} pts`)).toBeVisible();

    await page.getByRole("radio", { name: "Global" }).click();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: displayName })
        .filter({ hasText: String(score) }),
    ).toBeVisible();
  });

  await test.step("log out and back in: the progress is still there", async () => {
    await page
      .getByRole("button", { name: /Log out/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel(/Email or username/).fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: /Log in/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(displayName);
    await expect(page.getByText(`${score}`, { exact: true }).first()).toBeVisible();
  });
});

test("the page can only call its own API", async ({ page }) => {
  // The journey above shows the API is reachable. The served header allows any https origin
  // (it's written before the API's host is known); the build's <meta> policy narrows that.
  await page.goto("/login");
  const blocked = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener(
          "securitypolicyviolation",
          (event) => resolve(`${event.effectiveDirective} ${event.blockedURI}`),
          { once: true },
        );
        fetch("https://example.com/elsewhere").catch(() => {});
        setTimeout(() => resolve("not blocked"), 5_000);
      }),
  );
  expect(blocked).toBe("connect-src https://example.com/elsewhere");
});
