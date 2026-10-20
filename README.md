# WikiRace

Play it at [wikirace.day](https://wikirace.day).

[![Lint](https://github.com/Boharrisonabrams/wikirace-public/actions/workflows/lint.yml/badge.svg)](https://github.com/Boharrisonabrams/wikirace-public/actions/workflows/lint.yml)
[![Tests](https://github.com/Boharrisonabrams/wikirace-public/actions/workflows/tests.yml/badge.svg)](https://github.com/Boharrisonabrams/wikirace-public/actions/workflows/tests.yml)

WikiRace is a Wikipedia racing game. You start on one article and race to a target article using only the links inside each article. Everyone gets the same Daily race, which unlocks at local midnight and allows one ranked attempt plus unranked replays. Players can also practice or send a private race to a friend. Two leaderboards rank the Daily: shortest path and fastest active solve time. WikiRace ships as a web app, an Expo iOS app, and an Express API in one pnpm monorepo. Bo Abrams built it; most of the recorded work happened in July 2026.

## The defining decision: the server never trusts the client

A race result is only worth comparing if nobody can fake it, so no client decides what counts.

- **Every move is re-validated.** A client sends only the session ID and the destination title. The API reads the current article from its own stored path, fetches that article's real outbound links from Wikipedia, and accepts the move only if the destination is linked (`POST /api/game/navigate` in `artifacts/api-server/src/routes/game.ts`, pure check in `src/lib/game/validate-move.ts`).
- **Completion commits in one transaction.** Finishing a race, updating stats and streaks, and recording the result happen inside one Postgres function, `complete_game_session_v2`, under a per-session advisory lock. A retry returns the stored result instead of counting twice (`supabase/migrations/20260710160000_atomic_completion_effects.sql`).
- **pgTAP tests prove it.** `supabase/tests/atomic_completion_effects.sql` (28 assertions) forces a failure that must roll back, then checks that the retry applies the effects exactly once. Three more suites cover challenge-link privacy, daily ranks, and guest exclusion from public boards.
- **The API is the only game writer.** It holds the Supabase service-role key, and database policies keep game writes on the server.

## Architecture

```
artifacts/web     (React 19, Vite)  ─┐
                                     ├─>  artifacts/api-server (Express 5)  ─>  Wikipedia APIs
artifacts/mobile  (Expo SDK 54)     ─┘            │
                                                  └─>  supabase/ (Postgres: migrations, RPCs, pgTAP)
```

- `artifacts/api-server`: rules engine, Wikipedia fetch and HTML sanitizing, rate limits. It also serves the built web app from one Docker image (`Dockerfile`, `railway.json`).
- `artifacts/web` and `artifacts/mobile`: thin clients. Mobile renders articles in a WebView and sends link taps to the API.
- `lib/game-client`: the client logic both apps share (active timer, username rules, article search and find, player session, account claim), with its own tests. The matching files in each app re-export it and keep only platform code.
- `lib/share-intent`: spoiler-safe share copy shared by both clients.
- `supabase/`: 10 migrations with security-definer RPCs, plus 4 pgTAP suites.

## Run it

You need Node 24, pnpm 11, Docker, and the Supabase CLI (CI uses Node 24 and pnpm 11.1.2).

```sh
pnpm install
supabase start && supabase db push --local          # local Postgres + auth
cd artifacts/api-server && pnpm build && PORT=8081 pnpm start                    # terminal 1
cd artifacts/web && PORT=5173 BASE_PATH=/ API_PROXY_TARGET=http://localhost:8081 pnpm dev   # terminal 2
pnpm --filter ./artifacts/mobile start                                            # terminal 3, Expo
```

Environment variables (names come from the source; `supabase status` prints local values):

- API (`artifacts/api-server/.env.local`): `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; optional `PUBLIC_APP_URL`, `APPLE_TEAM_ID`, `LOG_LEVEL`, `SERVE_STATIC_DIR`.
- Web (`artifacts/web/.env.local`, build time): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_GOOGLE_AUTH_ENABLED`. Vite also requires `PORT` and `BASE_PATH`.
- Mobile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, optional `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED`, `EXPO_PUBLIC_APPLE_AUTH_ENABLED`, and `EXPO_PUBLIC_APP_URL`. The app config also reads `EAS_PROJECT_ID` for EAS builds and updates.

Tests:

```sh
pnpm lint && pnpm format:check && pnpm typecheck        # ESLint, Prettier, tsc (CI: Lint workflow)
pnpm --filter ./artifacts/api-server test                # Vitest, 18 files (CI)
pnpm --filter ./artifacts/mobile test                    # Vitest, 40 files (CI)
pnpm --filter ./artifacts/mobile exec vitest run ../../lib/game-client/src --root ../..   # Vitest, 8 files (CI)
pnpm --filter ./artifacts/mobile exec vitest run ../../lib/share-intent/src/index.test.ts --root ../..   # (CI)
pnpm --filter ./artifacts/web typecheck && PORT=8080 BASE_PATH=/ pnpm --filter ./artifacts/web build   # (CI)
PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web test:unit # Vitest, 14 files (CI: Tests workflow)
pnpm --dir artifacts/web test:e2e                        # Playwright, 5 specs, local only, needs the local stack
supabase test db --local                                 # pgTAP, 4 suites (CI: Tests workflow; locally needs the stack)
```

To deploy, follow `docs/DEPLOY.md`: one Railway service built from the root `Dockerfile`, with `/api/healthz` as the health check.

## Status

- **Web:** live. Play it at [wikirace.day](https://wikirace.day). A check on 2026-10-15 got HTTP 200 from the root and from `/api/healthz`. It runs on Railway with hosted Supabase. Successful deploys are recorded from 2026-07-10 to 2026-07-14 (`docs/NEXT-ITERATION-BACKLOG.md`, `docs/PROJECT_MAP.md`, `docs/ai/state.md`).
- **iOS:** not on the App Store yet. A TestFlight build was installed on a physical iPhone on 2026-07-16 and loaded the Daily from production. An external friend group went to Beta App Review the same day; the repo does not record the outcome. TestFlight builds expire 90 days after upload, so that build is no longer installable. The next step is an App Store release.
- **Tests:** a full local run on 2026-10-19 passed 138 API, 321 mobile, 32 web unit, 77 game-client, and 4 share-intent tests, and the CI, Lint, and Tests workflows were green on `main` the same day. The last recorded run before the October cleanup (2026-07-29, `docs/ai/state.md`) passed 137 API, 299 mobile, and 4 share-intent tests.
- **What went wrong:** the first native iOS build failed on an unused canary Expo package that simulator runs never compiled. An unpinned `eas submit` auto-invited every App Store Connect user on the Apple team. Both became rules in `CLAUDE.md`. `docs/DEPLOY.md` keeps Railway build rules "learned the hard way", such as root-relative `.railwayignore` globs and an SPA catch-all for deep links.

## Built with AI agents

Agents wrote the code through a two-agent loop defined in `CLAUDE.md`, `AGENTS.md`, and `.claude/commands/`. Claude Opus writes the plan (`/architect`) and a draft review (`/review-codex`). Codex implements, runs the tests, logs each cycle in `docs/ai/state.md`, and writes the final review adjudication (ACCEPT, REJECT, or ADJUST for each finding). An image model generated the brand monogram in `artifacts/brand/` (its C2PA manifest says so). The product itself makes no model calls.

Bo kept these for himself:

- The product decisions: the ten approved choices in `docs/superpowers/specs/2026-07-10-daily-ritual-foundation-design.md`.
- The brief and acceptance criteria for each cycle (`/task` interviews him), and the call on when each stage advances.
- Approval for any network, credential, production-database, or destructive step, and for commits in Claude-launched cycles.
- Every release action: hosted keys, Supabase and Railway setup, App Store Connect records, and TestFlight distribution.

## Known gaps

- The shared client logic now lives in `lib/game-client`, but the 16 same-named files in `artifacts/mobile/src/lib` and `artifacts/web/src/lib` still exist as re-exports plus platform code. The apps should import the package directly so the re-exports can go. `api.ts` and `social-auth.ts` stay separate on purpose: their transport and auth flows differ by platform, and `formatTime` and `requestEmailClaim` still behave differently in each app.
- CI now runs the web Vitest units and the four pgTAP suites in the Tests workflow, and the Lint workflow runs ESLint, Prettier, and the typecheck. Playwright still does not run in CI. The API concurrency test mocks Supabase, so the pgTAP run is what proves database atomicity.
- Template leftovers remain: `lib/api-spec` and `lib/api-zod` (they describe only `/healthz`), `lib/api-client-react`, Replit Vite plugins in the web config, and the Expo starter README and LICENSE in `artifacts/mobile`.
- The four longest mobile routes were split into components in October 2026 and now run 569 to 828 lines, but `reminders.ts` is still 1,184 lines, and `routes/game.ts` still has a long `/game/start` handler and an `any`-typed session. `tests/public-copy.test.ts` reads route source text, which pins some copy and handlers in the routes.
- Some docs are stale: `docs/ai/task.md` is an early brief, and `artifacts/mobile/AGENTS.md` points at Expo SDK 57 docs while the app pins SDK 54.
- Deploy-specific values (the public host, EAS project ID, Apple Team ID, and Supabase auth URLs) are read from the environment, with placeholders as defaults. The "Deploy values" table in `docs/DEPLOY.md` lists each variable. Two placeholders still live in files: the App Store Connect app ID in `artifacts/mobile/eas.json`, because EAS CLI does not read it from the environment, and the support address in `artifacts/web/src/lib/legal-content.ts`. The live site at wikirace.day runs from the original checkout with real values; this export has not been deployed. The `docs/ai/evidence/` screenshots and recordings are not included.

<!--
Screenshots placeholder. The images below do not exist yet, so this section is
hidden to avoid broken images. Capture a mid-race screen on each platform (the
article, the path so far, and the search palette), save them under images/,
then move this section out of the comment.

## Screenshots

![WikiRace web race screen](images/web-race.png)
![WikiRace iOS race screen](images/ios-race.png)
-->

## License

MIT. See `LICENSE`.
