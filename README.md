# WikiRace

Play it at [wikirace.day](https://wikirace.day).

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
- Mobile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, optional `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` and `EXPO_PUBLIC_APPLE_AUTH_ENABLED`.

Tests:

```sh
pnpm --filter ./artifacts/api-server test                # Vitest, 18 files (CI)
pnpm --filter ./artifacts/mobile test                    # Vitest, 38 files (CI)
pnpm --filter ./artifacts/mobile exec vitest run ../../lib/share-intent/src/index.test.ts --root ../..   # (CI)
pnpm --filter ./artifacts/web typecheck && PORT=8080 BASE_PATH=/ pnpm --filter ./artifacts/web build   # (CI)
PORT=4173 BASE_PATH=/ pnpm --dir artifacts/web test:unit # Vitest, 15 files (local only)
pnpm --dir artifacts/web test:e2e                        # Playwright, 5 specs, needs the local stack
supabase test db --local                                 # pgTAP, needs the local stack
```

To deploy, follow `docs/DEPLOY.md`: one Railway service built from the root `Dockerfile`, with `/api/healthz` as the health check.

## Status

- **Web:** live. Play it at [wikirace.day](https://wikirace.day). A check on 2026-10-15 got HTTP 200 from the root and from `/api/healthz`. It runs on Railway with hosted Supabase. Successful deploys are recorded from 2026-07-10 to 2026-07-14 (`docs/NEXT-ITERATION-BACKLOG.md`, `docs/PROJECT_MAP.md`, `docs/ai/state.md`).
- **iOS:** not on the App Store yet. A TestFlight build was installed on a physical iPhone on 2026-07-16 and loaded the Daily from production. An external friend group went to Beta App Review the same day; the repo does not record the outcome. TestFlight builds expire 90 days after upload, so that build is no longer installable. The next step is an App Store release.
- **Tests:** the last recorded full run (2026-07-29, `docs/ai/state.md`) passed 137 API, 299 mobile, and 4 share-intent tests; the last web unit run (2026-07-25) passed 45.
- **What went wrong:** the first native iOS build failed on an unused canary Expo package that simulator runs never compiled. An unpinned `eas submit` auto-invited every App Store Connect user on the Apple team. Both became rules in `CLAUDE.md`. `docs/DEPLOY.md` keeps Railway build rules "learned the hard way", such as root-relative `.railwayignore` globs and an SPA catch-all for deep links.

## Built with AI agents

Agents wrote the code through a two-agent loop defined in `CLAUDE.md`, `AGENTS.md`, and `.claude/commands/`. Claude Opus writes the plan (`/architect`) and a draft review (`/review-codex`). Codex implements, runs the tests, logs each cycle in `docs/ai/state.md`, and writes the final review adjudication (ACCEPT, REJECT, or ADJUST for each finding). An image model generated the brand monogram in `artifacts/brand/` (its C2PA manifest says so). The product itself makes no model calls.

Bo kept these for himself:

- The product decisions: the ten approved choices in `docs/superpowers/specs/2026-07-10-daily-ritual-foundation-design.md`.
- The brief and acceptance criteria for each cycle (`/task` interviews him), and the call on when each stage advances.
- Approval for any network, credential, production-database, or destructive step, and for commits in Claude-launched cycles.
- Every release action: hosted keys, Supabase and Railway setup, App Store Connect records, and TestFlight distribution.

## Known gaps

- `artifacts/mobile/src/lib` and `artifacts/web/src/lib` share 17 same-named files. `active-timer.ts` and `username.ts` are byte-identical, and `game-search.ts` differs by 47 diff lines. `lib/share-intent` already shows the shared-package fix.
- CI skips the web Vitest units, Playwright, and pgTAP. The API concurrency test mocks Supabase, so only the local pgTAP run proves database atomicity.
- Template leftovers remain: `lib/api-spec` and `lib/api-zod` (they describe only `/healthz`), `lib/api-client-react`, Replit Vite plugins in the web config, and the Expo starter README and LICENSE in `artifacts/mobile`.
- Four mobile screens run past 1,100 lines and `reminders.ts` is 1,184 lines. `routes/game.ts` has a long `/game/start` handler and `any`-typed sessions. There is no root lint or format config.
- Some docs are stale: `docs/ai/task.md` is an early brief, and `artifacts/mobile/AGENTS.md` points at Expo SDK 57 docs while the app pins SDK 54.
- This export uses placeholders for the public host, support address, EAS project ID, App Store Connect app ID, and Apple Team ID. Set them before a real deploy. The live site at wikirace.day runs from the original checkout with real values; this export has not been deployed. The `docs/ai/evidence/` screenshots and recordings are not included.

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
