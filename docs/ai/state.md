# Implementation State

<!-- Owned by Codex. Updated after meaningful progress. Read by Claude during /review-codex. -->

> Public export note: the `docs/ai/evidence/` folders referenced below (screenshots, simulator
> recordings, and notes) are not part of this export. Account identifiers, build and deployment
> IDs, contact addresses, tester names, and the TestFlight invite link were removed from the
> release entries.

## Search tier hold at palette (2026-07-29, Codex implementation mode)

- Branch: `fix-search-tier-hold`
- Scope completed:
  - api-server `declaredSearchTier(...)` now clamps to `palette` behind an explicit hold constant so the 2026-07-27 find-perf rollback stays enforced without changing stored friend-challenge choices
  - unit coverage now pins the held behavior and preserves an explicit test for the underlying unclamped per-mode derivation
  - docs evidence captures the hold rationale and exact one-line revert under `docs/ai/evidence/search-tier-hold/notes.md`
- Files changed:
  - `artifacts/api-server/src/lib/game/session-mode.ts`
  - `artifacts/api-server/src/lib/game/session-mode.test.ts`
  - `docs/ai/evidence/search-tier-hold/notes.md`
- Verification completed:
  - `pnpm --dir artifacts/api-server exec vitest run src/lib/game/session-mode.test.ts` ✅ (`1 file, 10 tests passed`)
  - `pnpm --dir artifacts/api-server test` ✅ (`18 files, 137 tests passed`)
  - `pnpm --filter ./artifacts/mobile test` ✅ (`38 files, 299 tests passed`)
  - `pnpm --filter ./artifacts/mobile exec vitest run ../../lib/share-intent/src/index.test.ts --root ../..` ✅ (`1 file, 4 tests passed`)
  - `pnpm --filter ./artifacts/web typecheck` ✅
  - `PORT=8080 BASE_PATH=/ pnpm --filter ./artifacts/web build` ✅
- Architecture deviations:
  - `docs/ai/task.md` and `docs/ai/architecture.md` in this worktree are stale and unrelated to the July 29, 2026 search-tier hold request, so implementation is following the explicit user brief and repo rules.
- Next action:
  - commit, push, and open the PR against `main`

## Path reveal after completion (2026-07-25, Codex implementation mode)

- Branch: `feat-path-reveal`
- Scope completed:
  - api-server now strips finisher route data unless the caller has a completed session for the same daily or friend challenge, where completed means won or gave up
  - daily leaderboard and friend-challenge results now receive server-gated optional `path` data through the existing payloads, with one batched finisher-path lookup and no ranking RPC rewrites
  - web and mobile results rows are collapsed by default and expand locally without per-row refetch once the server includes eligible `path` data
  - share-copy output remains route-free; the shared formatter ignores any path-like fields present on result objects
- Files changed:
  - `artifacts/api-server/src/lib/game/path-reveal.ts`
  - `artifacts/api-server/src/routes/leaderboard.ts`
  - `artifacts/api-server/src/routes/leaderboard.test.ts`
  - `artifacts/api-server/src/routes/challenge.ts`
  - `artifacts/api-server/src/routes/challenge.test.ts`
  - `artifacts/web/src/components/ExpandableFinisherRow.tsx`
  - `artifacts/web/src/components/ExpandableFinisherRow.test.tsx`
  - `artifacts/web/src/pages/leaderboard.tsx`
  - `artifacts/web/src/pages/challenge.tsx`
  - `artifacts/mobile/src/components/expandable-finisher-row.tsx`
  - `artifacts/mobile/src/components/expandable-finisher-row.test.tsx`
  - `artifacts/mobile/src/app/(tabs)/leaderboard.tsx`
  - `artifacts/mobile/src/app/challenge/[code].tsx`
  - `artifacts/mobile/src/lib/api.ts`
  - `artifacts/mobile/src/lib/types.ts`
  - `lib/share-intent/src/index.test.ts`
  - `docs/ai/evidence/path-reveal/notes.md`
- Verification completed:
  - `pnpm --dir artifacts/api-server test` ✅ (`18 files, 136 tests passed`)
  - `pnpm --dir artifacts/mobile test` ✅ (`38 files, 299 tests passed`)
  - `PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web test:unit` ✅ (`15 files, 45 tests passed`)
  - `PORT=4173 BASE_PATH=/ pnpm --filter ./artifacts/web build` ✅
- Evidence:
  - `docs/ai/evidence/path-reveal/mobile-locked-challenge.png`
  - `docs/ai/evidence/path-reveal/mobile-revealed-leaderboard.png`
  - `docs/ai/evidence/path-reveal/web-challenge-locked.png`
  - `docs/ai/evidence/path-reveal/web-challenge-revealed.png`
  - `docs/ai/evidence/path-reveal/web-daily-locked.png`
  - `docs/ai/evidence/path-reveal/notes.md`
- Architecture deviations:
  - `docs/ai/task.md` and `docs/ai/architecture.md` in this checkout are stale and unrelated to the Saturday, July 25, 2026 path-reveal theme, so implementation followed the explicit user brief plus repo rules instead of those older docs.
  - For runtime proof, the checked-in local env pointed at a stale Supabase host. Evidence was captured against the branch-local API and web servers after overriding the local API env to the stable hosted Supabase project.
- Next action:
  - commit, push, and open the PR against `main` with the verification and evidence summary.

## Server-declared search tiers reconciliation (2026-07-25, Codex implementation mode)

- Branch: `feat-search-tiers`
- Reconciliation completed:
  - merged `origin/main` into this branch with a normal `git merge origin/main`
  - preserved from PR #21 / `origin/main`:
    - web guest claim offer in `artifacts/web/src/components/GameResultScreen.tsx`
    - guest-play session/result typing in `artifacts/web/src/lib/store/game-store.ts`
  - preserved from PR #22 / `origin/main`:
    - mobile identity-pack rank-tease/result presentation flow in `artifacts/mobile/src/app/result.tsx`
    - guest/claimed/rank fields in `artifacts/mobile/src/lib/types.ts`
  - preserved from this branch:
    - server-declared `searchTier` session capability and client fallback behavior
    - web/mobile challenge-result `Find only / Full palette` chooser
    - web in-article find UI for find-only sessions
- Follow-up fixes completed:
  - restored `artifacts/web/vite.config.ts` to the original hard-fail on missing `PORT` / `BASE_PATH` while keeping the scoped Vitest include/exclude block
  - made `artifacts/api-server/src/routes/challenge.ts` read-path tolerant of an absent `search_tier` column by switching `loadChallenge` back to `select("*")`
- Verification:
  - `pnpm --dir artifacts/api-server test` ✅ (`18 files, 132 tests passed`)
  - `pnpm --dir artifacts/mobile test` ✅ (`37 files, 297 tests passed`)
  - `PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web test:unit` ✅ (`14 files, 43 tests passed`)
  - `PORT=4173 BASE_PATH=/ pnpm --filter ./artifacts/web build` ✅
- Next action:
  - update the PR body with the merge-preservation notes, stage the merge resolution, commit, and push the branch

## Server-declared search tiers (2026-07-24, Codex implementation mode)

- Branch: `feat-search-tiers`
- Scope completed:
  - api-server now declares `searchTier` server-side from session mode and friend-challenge configuration, and includes it in session JSON
  - friend challenges now persist creator-selected search tier with an additive migration and API fallback when the column is absent
  - mobile and web gameplay now honor `session.searchTier` instead of inferring official-daily fairness locally, while still preserving the legacy fallback when cached sessions omit the field
  - web now has in-article text find with DOM highlighting and next/previous navigation for find-only sessions
  - mobile and web friend-challenge creation flows now default to `Find only` and expose the `Find only / Full palette` chooser
- Files changed:
  - `artifacts/api-server/src/lib/game/session-mode.ts`
  - `artifacts/api-server/src/lib/game/session-mode.test.ts`
  - `artifacts/api-server/src/lib/game/session-json.ts`
  - `artifacts/api-server/src/routes/challenge.ts`
  - `artifacts/api-server/src/routes/game.ts`
  - `artifacts/mobile/src/app/challenge/create.tsx`
  - `artifacts/mobile/src/app/game.tsx`
  - `artifacts/mobile/src/app/result.tsx`
  - `artifacts/mobile/src/components/game-search-sheet.tsx`
  - `artifacts/mobile/src/components/game-search-sheet.test.tsx`
  - `artifacts/mobile/src/lib/api.ts`
  - `artifacts/mobile/src/lib/api.test.ts`
  - `artifacts/mobile/src/lib/game-search.ts`
  - `artifacts/mobile/src/lib/game-search.test.ts`
  - `artifacts/mobile/src/lib/private-challenge.ts`
  - `artifacts/mobile/src/lib/private-challenge.test.ts`
  - `artifacts/mobile/src/lib/types.ts`
  - `artifacts/web/src/components/ArticleBrowser.tsx`
  - `artifacts/web/src/components/GameResultScreen.tsx`
  - `artifacts/web/src/components/GameResultScreen.test.tsx`
  - `artifacts/web/src/components/GameSearchPanel.tsx`
  - `artifacts/web/src/lib/article-find.ts`
  - `artifacts/web/src/lib/article-find.test.ts`
  - `artifacts/web/src/lib/friend-race-again.ts`
  - `artifacts/web/src/lib/friend-race-again.test.ts`
  - `artifacts/web/src/lib/game-search.ts`
  - `artifacts/web/src/lib/game-search.test.ts`
  - `artifacts/web/src/lib/store/game-store.ts`
  - `artifacts/web/src/pages/game.tsx`
  - `artifacts/web/vite.config.ts`
  - `supabase/migrations/20260724150000_friend_challenge_search_tier.sql`
  - `docs/ai/evidence/search-tiers/notes.md`
- Verification completed:
  - `pnpm --dir artifacts/api-server test` ✅ (`128 tests passed`)
  - `pnpm --dir artifacts/mobile test` ✅ (`293 tests passed`)
  - `PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web test:unit` ✅ (`34 tests passed`)
  - `pnpm --filter ./artifacts/web build` ✅
  - focused regression commands for API/mobile/web search-tier files ✅
  - evidence bundle written under `docs/ai/evidence/search-tiers/`
- Evidence:
  - `docs/ai/evidence/search-tiers/mobile-daily-find-only.png`
  - `docs/ai/evidence/search-tiers/mobile-practice-palette.png`
  - `docs/ai/evidence/search-tiers/web-daily-find-mobile.png`
  - `docs/ai/evidence/search-tiers/web-challenge-search-tier.png`
  - `docs/ai/evidence/search-tiers/notes.md`
- Architecture deviations:
  - `docs/ai/task.md` and `docs/ai/architecture.md` in this worktree were stale and unrelated to this theme, so implementation followed the explicit user brief plus the repo-level architecture requirements instead of those older docs.
  - For mobile/browser proof, the deployed API could not demonstrate the new `searchTier` contract, so the final screenshots used the branch API locally on `localhost:4010` with the same Supabase project as the app.
- Next action:
  - remove scratch evidence files, commit with a conventional message, push the branch, and open the PR with the migration callout first in the body.

## Web instant guest play for shared links and daily (2026-07-24, Codex implementation mode)

- Branch: `feat-web-guest-play`
- Scope completed:
  - web Daily and shared-challenge Play actions now create an anonymous Supabase session on demand and start immediately without a pre-race account wall
  - web result surfaces now offer guest players a post-finish account-save flow with `Create credentials` and a frictionless `Not now` dismissal
  - server-authoritative guest-vs-claimed leaderboard filtering stayed unchanged and is now covered by a dedicated local pgTAP
- Files changed:
  - `artifacts/web/src/pages/home.tsx`
  - `artifacts/web/src/pages/challenge.tsx`
  - `artifacts/web/src/pages/signup.tsx`
  - `artifacts/web/src/components/GameResultScreen.tsx`
  - `artifacts/web/src/lib/player-session.ts`
  - `artifacts/web/src/lib/claim-account.ts`
  - `artifacts/web/src/lib/store/game-store.ts`
  - `artifacts/web/src/pages/home.test.tsx`
  - `artifacts/web/src/pages/challenge.test.tsx`
  - `artifacts/web/src/components/GameResultScreen.test.tsx`
  - `artifacts/web/src/lib/player-session.test.ts`
  - `artifacts/web/src/lib/claim-account.test.ts`
  - `artifacts/web/e2e/guest-play.spec.ts`
  - `supabase/tests/guest_leaderboard_exclusion.sql`
  - `docs/ai/evidence/web-guest-play/notes.md`
  - `docs/ai/evidence/web-guest-play/*.png`
- Architecture deviations:
  - `docs/ai/task.md` and `docs/ai/architecture.md` in this checkout are stale and describe an older mobile scaffolding lane, not the July 24, 2026 "Web instant guest play" theme. This branch is following the direct user brief as the authoritative plan.
- Verification completed:
  - `PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web exec vitest run src` ✅ (`13 files, 50 tests passed`)
  - `PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web exec vitest run src/components/GameResultScreen.test.tsx src/pages/challenge.test.tsx src/pages/home.test.tsx src/lib/player-session.test.ts src/lib/claim-account.test.ts` ✅ (`5 files, 12 tests passed`)
  - `PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web build` ✅
  - `supabase db reset --local` ✅
  - `supabase test db supabase/tests/guest_leaderboard_exclusion.sql --local` ✅
  - `PORT=5173 BASE_PATH=/ E2E_BASE_URL=http://localhost:5173 DB_URL=... pnpm --dir artifacts/web exec playwright test e2e/guest-play.spec.ts` ✅ (`2 passed`)
  - local browser evidence captured under `docs/ai/evidence/web-guest-play/` ✅
- Caveats:
  - The repo's Vite config requires explicit `PORT` and `BASE_PATH` env vars, so web Vitest/build verification must be run with those env vars present in this checkout.
- Next action:
  - commit, push, and open the PR against `main` with the evidence and verification summary.

## Founder-visible version stamps on web and mobile (2026-07-23, Codex implementation mode)

- Branch: `feat-version-stamp`
- Scope completed:
  - web home page footer stamp in `artifacts/web` using package version plus a Vite build-time date constant
  - mobile home footer stamp in `artifacts/mobile` using existing `expo-constants` and `expo-updates` only
  - pure mobile label formatter in `src/lib` with unit coverage for embedded vs OTA launches
- Files changed:
  - `artifacts/web/vite.config.ts`
  - `artifacts/web/src/env.d.ts`
  - `artifacts/web/src/pages/home.tsx`
  - `artifacts/mobile/src/app/(tabs)/index.tsx`
  - `artifacts/mobile/src/lib/version-stamp.ts`
  - `artifacts/mobile/src/lib/version-stamp.test.ts`
- Verification completed:
  - `pnpm --dir artifacts/mobile test` ✅ (`35 files, 272 tests passed`)
  - `PORT=8080 BASE_PATH=/ pnpm --dir artifacts/web typecheck` ✅
  - `PORT=8080 BASE_PATH=/ pnpm --dir artifacts/web build` ✅
- Architecture deviations:
  - None. The change stays JS/TS-only, adds no dependencies, and avoids any git-derived build metadata so the existing Docker build path remains unchanged.
- Next action:
  - commit, push, and open the PR to `main` with exact file references and pasted verification output.

## Web share-time + Fastest zero-time fix (2026-07-21, Codex implementation mode)

- Branch: `fix-web-share-time`
- Scope completed:
  - shared result formatter no longer prints `0:00`; zero or absent elapsed time now collapses to clicks-only copy
  - web gameplay now uses the server-authoritative timing flow (`resume` / `pause` / `heartbeat`) instead of wall-clock `startedAt`
  - Fastest leaderboard hole is real in the checked-in SQL before this fix, and the branch patches the RPCs so zero-`active_time_ms` winners are excluded from Fastest ranking while remaining visible on Shortest
  - `get_daily_player_ranks` now again returns `eligible_count` alongside ranks, matching the API completion-result code path and existing API tests
- Files changed:
  - `lib/share-intent/src/index.ts`
  - `lib/share-intent/src/index.test.ts`
  - `artifacts/mobile/src/lib/share-intent.test.ts`
  - `artifacts/mobile/app.test.ts`
  - `artifacts/web/e2e/share-copy.spec.ts`
  - `artifacts/web/src/lib/api.ts`
  - `artifacts/web/src/lib/active-timer.ts`
  - `artifacts/web/src/lib/store/game-store.ts`
  - `artifacts/web/src/components/GameHeader.tsx`
  - `artifacts/web/src/components/ArticleBrowser.tsx`
  - `artifacts/web/src/pages/game.tsx`
  - `supabase/migrations/20260721103000_fastest_zero_time_guard.sql`
  - `supabase/tests/daily_player_ranks.sql`
- Leaderboard verdict:
  - Real bug, not hypothetical.
  - Evidence in pre-fix checked-in SQL:
    - `supabase/migrations/20260710080000_daily_ritual_foundation.sql` orders Fastest by `active_time_ms asc` with no `> 0` guard in either `get_daily_leaderboard_v2` or `get_daily_player_ranks`.
    - `artifacts/api-server/src/lib/game/completion-result.ts` already expects `eligible_count` from `get_daily_player_ranks`, but the checked-in later SQL no longer returned it.
  - Branch fix:
    - new migration `20260721103000_fastest_zero_time_guard.sql` rebuilds both RPCs so Fastest ranks only sessions with `active_time_ms > 0`, while Shortest still ranks all claimed official winners.
    - `supabase/tests/daily_player_ranks.sql` now asserts that a zero-active-time winner gets `fastest_rank = null` and is absent from `get_daily_leaderboard_v2(..., 'fastest', ...)`.
- Web timing notes:
  - The previous web header timer was wall-clock `Date.now() - startedAt`, which did not feed `/game/timing`.
  - The new web flow mirrors the mobile active timer architecture:
    - article load start pauses locally
    - article ready resumes and syncs `/game/timing`
    - visibility changes pause/resume
    - heartbeats sync every 15 seconds
    - screen exit finalizes the pause request
  - Move requests still keep the server as source of truth; `/api/game/navigate` and `/api/game/complete` remain authoritative and already pause/finalize timing server-side.
- Runtime repro / proof boundary:
  - I confirmed the root cause statically before editing from the checked-in code path:
    - shared formatter rendered `formatElapsedTime(input.elapsedSeconds)` unconditionally
    - web client had no `/game/timing` calls at all
    - Fastest RPC had no zero-time guard
  - I brought up local Supabase successfully once earlier on July 21, 2026, but the Docker/port path was not stable enough to complete a clean pre-fix browser repro before the branch was patched.
  - Later on July 21, 2026:
    - sandboxed web/API listeners failed with `listen EPERM`
    - unsandboxed API Vitest succeeded
    - Docker access regressed again during later `supabase`/`psql` attempts, so the targeted SQL file was verified by static SQL diff plus migration/test review, not by a clean final pgTAP run in this session
- Verification completed:
  - `pnpm typecheck` ✅
  - `pnpm --dir artifacts/api-server exec vitest run` ✅ (`107 passed`)
  - `pnpm --dir artifacts/mobile exec vitest run` ✅ (`241 passed`)
  - `pnpm --dir artifacts/web exec playwright test e2e/share-copy.spec.ts` ✅ (`10 passed`)
  - `artifacts/mobile/node_modules/.bin/vitest run lib/share-intent/src/index.test.ts --root .` ✅ (`3 passed`)
- Verification still blocked / not completed in this session:
  - full live web Playwright flow against local Supabase (`artifacts/web/e2e/full-game.spec.ts`) due unstable Docker/local-runtime availability after initial stack startup and the port-binding restrictions noted above
  - targeted local SQL execution of `supabase/tests/daily_player_ranks.sql` after the final migration, for the same Docker/runtime reason
- TestFlight friend-access memo for Bo (analysis only; no actions taken):
  - There is no redeem-code path for TestFlight here.
  - Option A: add the friend's specific email to the existing external TestFlight group in App Store Connect. Bo action only. New builds then auto-distribute to everyone already in that external group.
  - Option B: briefly re-enable the capped external public link, let the friend join, then disable it again once they are in. Bo action only. New builds still auto-distribute to the whole external group after they join.
  - Option C: keep them on the web fallback for now. That path works today, and this branch fixes the misleading `0:00` result copy for web-played shares.
  - Constraint to preserve in any Bo decision: external-group membership is sticky for later builds; once someone is in that group, future approved builds auto-distribute to the full group.
  - No TestFlight, App Store Connect, or `eas` actions were taken in this branch.
- Architecture deviations:
  - 2026-07-22: reconciled this branch with merged PR #4 via an ordinary `git merge origin/main`, keeping both web in-game search and authoritative web timing in the game screen. No history rewrite.
  - 2026-07-22 verification for the reconciliation merge:
    - `pnpm typecheck` ✅
    - `PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web exec vitest run src/lib/game-search.test.ts` ✅
    - `PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web exec vitest run` still fails in this repo because Vitest picks up the Playwright `artifacts/web/e2e/*.spec.ts` files directly and throws `Playwright Test did not expect test() to be called here` before browser execution. I did not change that runner wiring in this merge-only pass.

## Web in-game search for race screen (2026-07-21, Codex implementation mode)

- Branch: `feat-web-game-search`
- Scope: add a mobile-web-first in-game search surface to `artifacts/web` only,
  reusing the mobile branch's fairness/ranking model locally because PR #3
  (`claude/wikirace-mobile-search-4d2f8e`) is not merged into `main` yet.
- The final agreed behavior is narrower than the initial brief: the "In the
  article" section now searches **only occurrences inside legal
  `a.wiki-link[data-article]` terms**. Both sections remain navigation-only and
  every selection still flows through the existing `POST /api/game/navigate`
  move path. No plain-text page find / scroll-to-highlight behavior was built.
- Implemented:
  - legal-link inventory extraction from the rendered article DOM, including
    nearby prose snippets for context
  - shared web search helpers for:
    - official Daily fairness gate (`2+` chars for link browse/results)
    - fuzzy link ranking (`exact > prefix > word-start > substring`)
    - linked-term occurrence counting within clickable wiki links only
  - game search UI:
    - desktop compact search affordance in `GameHeader`
    - mobile bottom dock trigger plus bottom-sheet search panel
    - two sections: `Links on this page` and `In the article`
  - dedicated web unit tests in
    `artifacts/web/src/lib/game-search.test.ts`
  - dedicated Playwright spec scaffold in
    `artifacts/web/e2e/game-search.spec.ts`
- Files changed:
  - `artifacts/web/src/lib/article-links.ts`
  - `artifacts/web/src/lib/game-search.ts`
  - `artifacts/web/src/lib/game-search.test.ts`
  - `artifacts/web/src/components/GameSearchPanel.tsx`
  - `artifacts/web/src/components/ArticleBrowser.tsx`
  - `artifacts/web/src/components/GameHeader.tsx`
  - `artifacts/web/src/lib/store/game-store.ts`
  - `artifacts/web/src/pages/game.tsx`
  - `artifacts/web/e2e/game-search.spec.ts`
  - `artifacts/web/package.json`
  - `docs/NEXT-ITERATION-BACKLOG.md`
- Verification:
  - `pnpm typecheck` ✅
  - `PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web exec vitest run src/lib/game-search.test.ts` ✅
  - `pnpm --dir artifacts/api-server build` ✅
  - `pnpm --dir artifacts/web exec playwright test e2e/game-search.spec.ts` ❌
    blocked before test execution because Playwright browsers fail to launch in
    this environment (`Abort trap` in WebKit, Mach port rendezvous permission
    failure in Chromium headless shell).
  - `pnpm --dir artifacts/web exec playwright test e2e/game-search.spec.ts --browser chromium`
    ❌ same environment/browser-launch blocker before any app interaction
  - `pnpm --dir artifacts/api-server test` ❌ unrelated existing local test
    failures plus sandboxed `listen EPERM` in API tests that spin up ephemeral
    Express servers
  - `pnpm --dir artifacts/mobile test` ❌ unrelated existing failure in
    `app.test.ts` expecting `eas.submit.production` to equal `{}`
- Architecture deviations:
  - The local web search helpers were not hoisted into a shared workspace lib
    yet because the mobile search branch is still separate from `main`.
  - Playwright evidence capture is scaffolded but not yet produced because the
    local browser runtime cannot launch from this environment.
- Next action:
  - open the PR now with the passing web typecheck + linked-match unit tests as
    evidence, and call out Playwright/browser-launch verification as pending
    follow-up once the local browser environment is usable.

## Web Google sign-in behind feature flag (2026-07-22, Codex implementation mode)

- Branch: `feat-web-google-signin`
- Scope: add a dark-shipped Google OAuth entry point to `artifacts/web` login
  and signup only, gated behind `VITE_GOOGLE_AUTH_ENABLED` so the UI stays
  invisible until Bo enables the provider.
- Implemented:
  - web auth redirect helpers that preserve a safe internal `?next=` return
    path through the existing `/auth/callback` route
  - web social-auth availability helper mirroring the mobile flag shape, with
    Google enabled only when `VITE_GOOGLE_AUTH_ENABLED === "true"` and Apple
    intentionally unavailable on web for now
  - reusable `SocialAuthButtons` component structured for future provider
    expansion, currently rendering only `Continue with Google`
  - login and signup page integration using
    `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`
  - auth-callback return-path handling so OAuth sign-in lands on the preserved
    internal destination instead of always `/`
  - focused Vitest coverage for flag gating and `?next=` preservation
  - root `Dockerfile` build-arg wiring for `VITE_GOOGLE_AUTH_ENABLED`, so a
    Railway build can actually expose the flag to Vite
  - `docs/DEPLOY.md` service-variable row documenting the flag as build-time
    and disabled when unset
- Files changed:
  - `artifacts/web/src/components/SocialAuthButtons.tsx`
  - `artifacts/web/src/lib/auth-redirect.ts`
  - `artifacts/web/src/lib/auth-redirect.test.ts`
  - `artifacts/web/src/lib/social-auth-availability.ts`
  - `artifacts/web/src/lib/social-auth-availability.test.ts`
  - `artifacts/web/src/lib/social-auth.ts`
  - `artifacts/web/src/lib/social-auth.test.ts`
  - `artifacts/web/src/pages/auth-callback.tsx`
  - `artifacts/web/src/pages/login.tsx`
  - `artifacts/web/src/pages/signup.tsx`
  - `artifacts/web/src/env.d.ts`
  - `Dockerfile`
  - `docs/DEPLOY.md`
- Verification:
  - `pnpm typecheck` ✅
  - `PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web exec vitest run src/lib/auth-redirect.test.ts src/lib/social-auth-availability.test.ts src/lib/social-auth.test.ts` ✅
  - `pnpm exec prettier --write ...` on the touched web files ✅
- Architecture deviations:
  - None. This stayed inside `artifacts/web` and used a web-local helper layer
    rather than touching mobile or shared packages.
- Next action:
  - commit, push, and open the PR with a note that Supabase Google provider is
    still disabled and the feature remains dark until `VITE_GOOGLE_AUTH_ENABLED`
    is explicitly turned on.

## TestFlight re-release complete on new identity (2026-07-16, Claude implementation mode)

- New App Store Connect app record, name **"WikiRace: Wiki Racing Game"**,
  bundle ID `com.boabrams.wikirace`, with **Limited Access**.
- Build 1.0.0 (1) came from a new EAS build. The first submission wedged
  IN_QUEUE on EAS for ~90 minutes and was canceled via the EAS GraphQL API;
  the re-queued submission FINISHED normally. The pinned `ascAppId` submit
  created **no TestFlight groups and no auto-invites**.
- Apple processing completed. The internal group contains only Bo.
  **Physical-device proof done: Bo installed via TestFlight and the Daily
  challenge loads from production on his iPhone (2026-07-16).**
- Friends distribution: an external TestFlight group with a capped public link
  (the link is not part of the public export). Test Information was completed
  (guest-play review note, privacy URL, sign-in-required off), build 1.0.0 (1)
  attached, and **Beta App Review submitted on 2026-07-16, status "Waiting for
  Review."** After approval the link admits testers immediately; Bo re-caps the
  link (~10) and disables it once his friends have joined. The internal group
  remains Bo-only.

## iOS bundle ID changed after ASC app removal (2026-07-16, Claude implementation mode)

- Bo clarified the real requirement: the app **stays on the existing Apple
  developer team**; the problem was only EAS Submit auto-inviting the team's
  App Store Connect users. He pruned the non-Bo testers, then the first ASC app
  record was removed (partly unintentionally). ASC keeps a removed app's bundle
  ID bound forever: `com.boabrams.wikipath` no longer appears in the New App
  bundle-ID picker, so no new app record can use it.
- Fix: iOS bundle ID is now **`com.boabrams.wikirace`** (app.json,
  app.test.ts, README, PROJECT_MAP, FRIEND_BETA_PLAN, AUTH_PROVIDER_SETUP).
  Android package, Expo slug, EAS project ID, schemes, Supabase, and Railway
  are unchanged. The Apple identifier `com.boabrams.wikipath` remains
  registered in the developer portal (leave it; it is inert).
- Release procedure from here: rebuild (registers the new App ID + new
  provisioning profile, reusing the existing distribution certificate), Bo
  manually creates the ASC app record for `com.boabrams.wikirace`, then submit
  with **`ascAppId` pinned in eas.json**. Pinning skips EAS's "ensure app
  exists" step, which is what auto-created the `Team (Expo)` group and
  auto-invited the team. Never submit without the pinned `ascAppId` for this
  app.
- Distribution policy (Bo, explicit): internal group containing only Bo first;
  friends later via an external group's **public link capped at 10 testers**,
  disabled after his friends join. No auto-invites, ever.

## TestFlight release shipped (2026-07-15, Claude implementation mode)

- The Apple gate cleared: the team's Account Holder accepted the updated
  Developer Program License Agreement, and the retried flow registered bundle
  ID `com.boabrams.wikipath`, reused the team's distribution certificate, and
  created an active provisioning profile.
- First production EAS build (buildNumber 3) failed with `XCODE_BUILD_ERROR`:
  `ExpoSwiftUI.SafeAreaControllable` / `RNHostViewProtocol` missing and a
  `from:appContext:` label mismatch. Root cause:
  `@expo/ui@0.2.0-canary-20260121-a63c0dd` compiled against a newer
  `expo-modules-core` than SDK 54. It, `expo-glass-effect`, and
  `expo-symbols` had zero imports in `src/` (template leftovers) and were
  removed from `artifacts/mobile/package.json`; lockfile refreshed; mobile
  tests 240/240 pass. Prior "iOS export" proofs never compiled Swift, so this
  only surfaced on the first real native build.
- The next build (1.0.0, buildNumber 4, Expo SDK 54) FINISHED and was
  submitted via EAS Submit with the existing App Store Connect API key. Apple
  processing completed and TestFlight delivered the build; it installs and
  runs against production (Daily challenge renders from the hosted API).
- ASC app record created under a provisional name ("WikiRace" is taken
  storewide); rename pending in App Store Connect, App Information. Because
  this submit was unpinned, EAS auto-created the internal TestFlight group
  `Team (Expo)` and enabled every App Store Connect user on the team; pruning
  it to Bo is recommended to stop future team-wide build emails.
- `eas.json` now records the saved "don't ask again" push-notifications
  preference (no APNs key was created; the app uses local notifications only).
- Remaining for friend distribution: physical-iPhone smoke pass, external
  `WikiRace Beta` group with Test Information (privacy URL on the production
  web host, guest-play review note), first-build Beta App Review (~24 to 48h),
  then the public link.

## TestFlight release attempt (2026-07-14)

- PR #2 was marked ready and merged to `main` as merge commit `552b1ed`.
- The required one-container Docker build passed locally. Direct route smoke
  returned 200 for `/`, `/daily`, `/privacy`, `/support`, a challenge route,
  and `/api/healthz`.
- A Railway deployment reached `SUCCESS` using the root Dockerfile and
  `/api/healthz`. Hosted checks passed for the root, Daily, Privacy, Support,
  the approved share-card asset, Wikipedia suggestions, and the safe
  unauthenticated account-deletion 401.
- EAS production build number was initialized to 1 for the stable EAS
  project. No iOS build or signing credentials were created because Apple
  blocked bundle-ID registration with the exact error `Apple Developer Program
  License Agreement Updated`. The Account Holder must accept the agreement at
  `https://developer.apple.com/account` before the production EAS build can be
  retried.
- The intended first distribution is internal TestFlight. External testers or
  a public link require an external group and first-build Beta App Review after
  the signed build is processed by App Store Connect.

## Architecture deviation: App Store readiness batch (2026-07-14)

- Bo explicitly approved the next release-readiness batch after the July 13
  sharing work: mobile Profile/Friends/Settings, account deletion,
  privacy/support surfaces, leaderboard coverage, and production EAS
  configuration. This supersedes the original scaffold brief's now-stale
  exclusion of friends/profile UI and EAS configuration.
- The stable EAS project ID, Expo slug, Railway/Supabase identities, dual URL
  schemes, and `com.boabrams.wikipath` bundle/package identifier remain
  unchanged. App Store submission and public TestFlight distribution remain
  gated on a successful signed build plus physical-device verification.
- The checked-in mobile runtime is Expo SDK 54 even though the repo-local
  mobile instruction links SDK 57 documentation. Implementation will use SDK
  54-compatible APIs and dependencies; SDK 57 guidance is treated as a future
  upgrade compatibility check, not permission to upgrade the runtime inside
  this feature batch.
- Completed on `codex/share-private-game-polish`: authenticated hard deletion,
  the mobile You/Profile/Friends hub, public `/privacy` and `/support` pages,
  and separate preview/production EAS profiles. Production EAS environment
  variables now mirror the three approved preview variables without checking
  their values into Git.
- Release proof is green: mobile 240/240, API 107/107, web legal/share 11/11,
  all workspace typechecks, production web build, Expo Doctor 18/18, fresh iOS
  export, production EAS config resolution, and an iPhone 17 Pro simulator pass
  for Profile/Friends, Shortest/Fastest, Everyone/Friends, and the non-mutating
  delete-account confirmation. Railway deployment, signed EAS build,

## Identity pack (2026-07-24)

- Branch: `feat-identity-pack`
- Scope: guest official-daily rank tease, account-conflict `Sign in instead`, home identity chip.
- Files changed:
  - `artifacts/api-server/src/lib/game/completion-result.ts`
  - `artifacts/api-server/src/lib/game/completion-result.test.ts`
  - `artifacts/mobile/src/app/(tabs)/index.tsx`
  - `artifacts/mobile/src/app/result.tsx`
  - `artifacts/mobile/src/app/signup.tsx`
  - `artifacts/mobile/src/lib/home-model.ts`
  - `artifacts/mobile/src/lib/home-model.test.ts`
  - `artifacts/mobile/src/lib/result-presentation.ts`
  - `artifacts/mobile/src/lib/result-presentation.test.ts`
  - `artifacts/mobile/src/lib/types.ts`
  - `artifacts/mobile/tests/public-copy.test.ts`
- Behavior:
  - Guests now receive a private `wouldBeShortestRank` in the existing official-daily completion payload without changing any public leaderboard output.
  - Guest official-daily results show `You'd be #… today` plus the claim CTA.
  - Claim conflict now exposes a `Sign in instead` action with the exact supporting copy `Games played on this phone stay with its guest profile`.
  - Home now shows a quiet identity chip that opens Profile for both guest and claimed users.
- Tests run:
  - `pnpm --dir artifacts/api-server test` ✅
  - `pnpm --dir artifacts/mobile test` ✅
- Evidence:
  - `docs/ai/evidence/identity-pack/guest-daily-rank-tease.png`
  - `docs/ai/evidence/identity-pack/account-conflict-sign-in-instead.png`
  - `docs/ai/evidence/identity-pack/home-chip-claimed.png`
  - `docs/ai/evidence/identity-pack/home-chip-guest.png`
  - `docs/ai/evidence/identity-pack/notes.md`
- Architecture deviations:
  - None.
- Questions:
  - None.
