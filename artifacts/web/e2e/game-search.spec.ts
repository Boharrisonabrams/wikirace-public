import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function signUp(page: Page) {
  const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await page.goto("/signup");
  await page.fill("#username", `search${runId.slice(-8)}`);
  await page.fill("#email", `search-${runId}@example.com`);
  await page.fill("#password", "e2e-password-123");
  await page.click('button[type="submit"]');
  await expect(page.getByText("Daily challenge")).toBeVisible({
    timeout: 15_000,
  });
}

async function authToken(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((value) =>
      value.endsWith("-auth-token"),
    );
    if (!key) return null;
    return JSON.parse(localStorage.getItem(key)!).access_token as string;
  });
}

async function startDeterministicFriendRace(page: Page) {
  const token = await authToken(page);
  expect(token).toBeTruthy();

  const challengeRes = await page.request.post("/api/challenge", {
    headers: { Authorization: `Bearer ${token}` },
    data: { startArticle: "Pizza", endArticle: "Italy" },
  });
  expect(challengeRes.ok()).toBeTruthy();
  const { challenge } = await challengeRes.json();

  await page.goto(`/challenge/${challenge.id}`);
  await expect(page.getByText("Pizza")).toBeVisible();
  await page.getByRole("button", { name: /accept the challenge/i }).click();
  await expect(page).toHaveURL(/\/game\?type=friend/);
  await expect(page.locator("a.wiki-link").first()).toBeVisible({
    timeout: 30_000,
  });
}

async function openSearch(page: Page) {
  const mobileTrigger = page.getByText("Search linked terms");
  if (await mobileTrigger.isVisible().catch(() => false)) {
    await mobileTrigger.click();
    return;
  }

  await page.getByRole("button", { name: /search page/i }).click();
}

async function fillSearch(page: Page, query: string) {
  const input = page.locator("#game-search-input");
  await expect(input).toBeVisible();
  await input.fill(query);
}

async function capture(testInfo: TestInfo, name: string, page: Page) {
  await page.screenshot({ fullPage: true, path: testInfo.outputPath(name) });
}

test("mobile official Daily shows the 2-character gate", async ({
  page,
}, testInfo) => {
  await signUp(page);
  await page.getByRole("button", { name: /start today's race/i }).click();
  await expect(page).toHaveURL(/\/game\?type=daily/);
  await expect(page.locator("a.wiki-link").first()).toBeVisible({
    timeout: 30_000,
  });

  await openSearch(page);
  await fillSearch(page, "a");

  await expect(page.getByTestId("search-links-hint")).toContainText(
    "Type 2+ letters",
  );
  await capture(testInfo, "mobile-gated.png", page);
});

test("mobile friend race supports browse, linked matches, empty state, and navigation", async ({
  page,
}, testInfo) => {
  await signUp(page);
  await startDeterministicFriendRace(page);

  await openSearch(page);
  await expect(page.getByTestId("search-link-row-0")).toBeVisible();
  await capture(testInfo, "mobile-browse.png", page);

  await fillSearch(page, "ital");
  await expect(page.getByTestId("search-link-row-0")).toContainText("Italy");
  await expect(page.getByTestId("search-text-section")).toContainText("Italy");
  await capture(testInfo, "mobile-results.png", page);

  await fillSearch(page, "zzzz");
  await expect(page.getByTestId("search-links-hint")).toContainText(
    "No links match",
  );
  await expect(page.getByTestId("search-text-hint")).toContainText(
    "No linked matches",
  );
  await capture(testInfo, "mobile-no-match.png", page);

  await fillSearch(page, "ital");
  await page.getByTestId("search-text-row-0").click();
  await expect(page.getByText(/you reached/i)).toBeVisible({
    timeout: 20_000,
  });
  await capture(testInfo, "mobile-search-navigate.png", page);
});

test.describe("desktop search evidence", () => {
  test.use({
    viewport: { width: 1280, height: 900 },
    isMobile: false,
    hasTouch: false,
  });

  test("desktop friend race shows browse, results, empty state, and navigation", async ({
    page,
  }, testInfo) => {
    await signUp(page);
    await startDeterministicFriendRace(page);

    await openSearch(page);
    await expect(page.getByTestId("search-link-row-0")).toBeVisible();
    await capture(testInfo, "desktop-browse.png", page);

    await fillSearch(page, "ital");
    await expect(page.getByTestId("search-link-row-0")).toContainText("Italy");
    await capture(testInfo, "desktop-results.png", page);

    await fillSearch(page, "zzzz");
    await expect(page.getByTestId("search-text-hint")).toContainText(
      "No linked matches",
    );
    await capture(testInfo, "desktop-no-match.png", page);

    await fillSearch(page, "ital");
    await page.getByTestId("search-text-row-0").click();
    await expect(page.getByText(/you reached/i)).toBeVisible({
      timeout: 20_000,
    });
    await capture(testInfo, "desktop-search-navigate.png", page);
  });
});
