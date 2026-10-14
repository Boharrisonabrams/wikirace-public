# Task

## Goal

Scaffold the WikiPath native app: an Expo (React Native) package in `artifacts/mobile` that signs in with Supabase, plays the daily challenge through the existing server-authoritative API, and runs in Expo Go, the first step toward EAS builds and TestFlight.

## Context

Bo chose the Expo/React Native track (2026-07-09). The backend needs zero changes: it already validates every move server-side and serves sanitized article HTML with only legal links tappable. The mobile app is a thin client, like the web app. The web app stays the reference implementation.

## Constraints

- Expo managed workflow, current SDK, TypeScript, pnpm monorepo integration (`expo/metro-config` monorepo support; do not switch the workspace to hoisted linking without evidence it's required).
- Auth: `@supabase/supabase-js` + AsyncStorage session persistence. Same email/password flows as web.
- API access through `EXPO_PUBLIC_API_URL` (defaults to the LAN dev address in dev).
- Article play: WebView (`react-native-webview`) rendering a small local HTML shell; article HTML fetched from `/api/wikipedia/article/:title`; `.wiki-link` taps bridge via `postMessage` to RN, which calls `/api/game/navigate` and swaps in the next article. Reuse the wiki-article CSS from the web app.
- Keep the game rules identical: back = one click, give up confirm, server decides wins.

## Out of scope (this cycle)

- EAS/TestFlight config (next cycle, after Bo's Apple Developer enrollment).
- Push notifications, deep links/universal links, friends UI, profile UI (daily + practice + result + leaderboard read are enough for the first bootable build).
- App Store assets/screenshots.

## Acceptance criteria

- [ ] `pnpm --filter ./artifacts/mobile start` boots Metro; the app loads in Expo Go.
- [ ] Sign up / sign in against Supabase works (local stack in dev).
- [ ] Daily challenge: start → article renders in WebView → tapping a legal link advances (server-validated) → reaching the target shows a result screen with clicks/time/streak → give up works.
- [ ] Practice mode works.
- [ ] Leaderboard screen reads the daily board.
- [ ] `pnpm typecheck` passes for the workspace including the new package.
