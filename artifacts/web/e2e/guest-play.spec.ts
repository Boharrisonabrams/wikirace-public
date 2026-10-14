import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

const dbUrl = process.env.DB_URL;

function hasAnonymousAuthStorage(page: Page) {
  return page.evaluate(() =>
    Object.values(window.localStorage).some((value) => {
      if (typeof value !== "string") return false;
      try {
        const parsed = JSON.parse(value);
        return parsed?.user?.is_anonymous === true;
      } catch {
        return value.includes('"is_anonymous":true');
      }
    }),
  );
}

function seedSharedChallenge() {
  if (!dbUrl) {
    throw new Error("DB_URL is required to seed the shared challenge test.");
  }

  execFileSync(
    "psql",
    [
      dbUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `
insert into auth.users (id, email, raw_user_meta_data, is_anonymous, created_at, updated_at)
values (
  '40000000-0000-4000-8000-000000000001',
  'playwright-challenge-creator@example.test',
  '{"username":"playwright_creator"}'::jsonb,
  false,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.friend_challenges (
  id,
  creator_id,
  short_code,
  challenge_type,
  daily_challenge_id,
  start_article,
  end_article,
  start_article_title,
  end_article_title,
  end_article_aliases,
  start_description,
  end_description
)
values (
  '40000000-0000-4000-8000-000000000010',
  '40000000-0000-4000-8000-000000000001',
  'gueste2e1',
  'friend',
  null,
  'Earth',
  'Moon',
  'Earth',
  'Moon',
  '{}'::text[],
  'our home world',
  'the only natural satellite of Earth'
)
on conflict (id) do update set
  short_code = excluded.short_code,
  start_article = excluded.start_article,
  end_article = excluded.end_article,
  start_article_title = excluded.start_article_title,
  end_article_title = excluded.end_article_title,
  end_article_aliases = excluded.end_article_aliases,
  start_description = excluded.start_description,
  end_description = excluded.end_description;
      `,
    ],
    { stdio: "pipe" },
  );
}

test("logged-out Daily starts immediately as a guest", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /play today's race/i }).click();
  await page.waitForURL(/\/game\?type=daily/);

  expect(await hasAnonymousAuthStorage(page)).toBe(true);
  await expect(page).not.toHaveURL(/\/signup/);
});

test("logged-out shared challenge starts immediately as a guest", async ({
  page,
}) => {
  test.skip(!dbUrl, "DB_URL is required for shared challenge seeding.");
  seedSharedChallenge();

  await page.goto("/challenge/gueste2e1");
  await page.getByRole("button", { name: /accept the challenge/i }).click();
  await page.waitForURL(/\/game\?type=friend/);

  expect(await hasAnonymousAuthStorage(page)).toBe(true);
  await expect(page).not.toHaveURL(/\/signup/);
});
