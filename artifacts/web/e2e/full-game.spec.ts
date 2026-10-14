import { test, expect, type Page } from "@playwright/test";

/**
 * Full happy path at a phone viewport against local Supabase and the real
 * Wikipedia API: sign up → daily challenge → validated move → give up →
 * result screen, then a deterministic head-to-head win (Pizza → Italy).
 */

const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const email = `e2e-${runId}@example.com`;
const password = "e2e-password-123";
const username = `e2e${runId.slice(-8)}`;

async function signUp(page: Page) {
  await page.goto("/signup");
  await page.fill("#username", username);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  // Signed-up users land on home with the daily card visible.
  await expect(page.getByText("Daily challenge")).toBeVisible({ timeout: 15_000 });
}

test("signup, play the daily, and finish a head-to-head race", async ({ page }) => {
  await signUp(page);

  // ── daily challenge: start, make one real validated move, give up ──
  await page.getByRole("button", { name: /start today's race/i }).click();
  await expect(page).toHaveURL(/\/game\?type=daily/);

  // A real Wikipedia article rendered with at least one legal link.
  const firstLink = page.locator("a.wiki-link").first();
  await expect(firstLink).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("0 clicks")).toBeVisible();

  await firstLink.click();
  await expect(page.getByText("1 click", { exact: false })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: /give up/i }).click();
  await page.getByRole("button", { name: "Give up" }).last().click();
  await expect(page.getByText("The trail went cold.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Your route")).toBeVisible();

  // ── head-to-head: create a known-solvable challenge via the API ──
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.endsWith("-auth-token"));
    if (!key) return null;
    return JSON.parse(localStorage.getItem(key)!).access_token as string;
  });
  expect(token).toBeTruthy();

  const challengeRes = await page.request.post("/api/challenge", {
    headers: { Authorization: `Bearer ${token}` },
    data: { startArticle: "Pizza", endArticle: "Italy" },
  });
  expect(challengeRes.ok()).toBeTruthy();
  const { challenge } = await challengeRes.json();

  // The public invite page shows the race and lets us accept it.
  await page.goto(`/challenge/${challenge.id}`);
  await expect(page.getByText("Pizza")).toBeVisible();
  await page.getByRole("button", { name: /accept the challenge/i }).click();

  // Pizza links Italy directly: a 1-click win, validated server-side.
  const italyLink = page.locator('a.wiki-link[data-article="Italy"]').first();
  await expect(italyLink).toBeVisible({ timeout: 30_000 });
  await italyLink.click();

  await expect(page.getByText(/you reached/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Italy.")).toBeVisible();
  await expect(page.getByText("Your route")).toBeVisible();

  // The results board shows our win.
  await page.getByRole("button", { name: /challenge results/i }).click();
  await expect(page).toHaveURL(new RegExp(`/challenge/${challenge.id}`));
  await expect(page.getByText(`@${username}`).or(page.getByText(username)).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("1 click", { exact: false }).first()).toBeVisible();
});

test("leaderboard shows tabs and loads", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByRole("button", { name: "Everyone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Friends" })).toBeVisible();
  await expect(page.getByText(/leaderboard/i).first()).toBeVisible();
});
